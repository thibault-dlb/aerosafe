from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock

import pytest

from config.opensky import OpenSkySettings
from services.collection.collector import DataCollector
from services.collection.cycle import CollectionCycle
from services.collection.flight_grouper import FlightGrouper
from services.collection.opensky_client import (
    OpenSkyRateLimited,
    OpenSkyUnavailable,
    StatesResponse,
)
from services.collection.profiles import BoundingBox, CollectionProfile, ProfileCode
from services.collection.run_state import (
    CollectionRunResult,
    InMemoryCollectionStateStore,
    RunStatus,
    get_state_store,
    state_store,
)
from services.collection.scheduler import CollectionBusy, CollectionDisabled, Scheduler

NOW = datetime(2026, 11, 9, 12, tzinfo=UTC)
PROFILE = CollectionProfile(ProfileCode.ILE_DE_FRANCE, BoundingBox(48.0, 49.3, 1.4, 3.6), 30)
VALID = ["3c6444", "DLH9LF", "Germany", 1_700_000_000, 1_700_000_000]
INVALID = ["nope", None, None, None, None]


class FakeClient:
    authenticated = False

    def __init__(self, outcome: StatesResponse | Exception) -> None:
        self.outcome = outcome

    async def fetch_states(self, _box: BoundingBox) -> StatesResponse:
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


class FakeStore:
    def __init__(self, _session: Any, _grouper: FlightGrouper) -> None:
        self.saved: list[Any] = []

    async def save(self, states: list[Any]) -> int:
        return len(states)

    async def close_stale_flights(self, _now: datetime) -> int:
        return 0


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


def collector(outcome: StatesResponse | Exception, clock: Clock) -> DataCollector:
    return DataCollector(
        FakeClient(outcome),  # type: ignore[arg-type]
        PROFILE,
        FlightGrouper(timedelta(minutes=30)),
        store_factory=FakeStore,  # type: ignore[arg-type]
        clock=clock,
    )


class Sessions:
    def __init__(self) -> None:
        self.opened: list[AsyncMock] = []

    @asynccontextmanager
    async def __call__(self) -> AsyncIterator[AsyncMock]:
        session = AsyncMock()
        self.opened.append(session)
        yield session


class Engine:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[datetime] = []

    def __call__(self, _session: Any) -> "Engine":
        return self

    async def evaluate(self, now: datetime) -> None:
        self.calls.append(now)
        if self.error:
            raise self.error


def cycle(
    outcome: StatesResponse | Exception,
    engine: Engine | None = None,
    store: InMemoryCollectionStateStore | None = None,
) -> tuple[CollectionCycle, InMemoryCollectionStateStore, Clock]:
    clock = Clock()
    store = store or InMemoryCollectionStateStore()
    built = CollectionCycle(
        collector(outcome, clock),
        store,
        session_factory=Sessions(),
        engine_factory=engine or Engine(),  # type: ignore[arg-type]
        clock=clock,
    )
    return built, store, clock


async def test_a_successful_cycle_collects_then_evaluates_at_the_collection_time() -> None:
    engine = Engine()
    run_cycle, store, _ = cycle(
        StatesResponse(time=1, states=[VALID], remaining_credits=399), engine
    )

    result = await run_cycle.run()

    assert result.status == RunStatus.SUCCESS
    assert (result.received, result.stored, result.rejected) == (1, 1, 0)
    assert result.remaining_credits == 399
    assert result.evaluation_error is None
    assert engine.calls == [NOW]
    assert await store.runs(10) == [result]
    assert await store.last_success() == result


async def test_rejected_states_make_a_partial_run() -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID, INVALID]))

    result = await run_cycle.run()

    assert (result.status, result.rejected) == (RunStatus.PARTIAL, 1)


async def test_an_unavailable_source_fails_the_run_without_evaluation() -> None:
    engine = Engine()
    run_cycle, _, _ = cycle(OpenSkyUnavailable("down"), engine)

    result = await run_cycle.run()

    assert (result.status, result.error) == (RunStatus.FAILED, "down")
    assert engine.calls == []


async def test_a_database_failure_fails_the_run() -> None:
    run_cycle, _, _ = cycle(RuntimeError("database down"))

    result = await run_cycle.run()

    assert result.status == RunStatus.FAILED
    assert "database down" in (result.error or "")


async def test_a_429_waits_for_the_announced_delay() -> None:
    run_cycle, _, clock = cycle(OpenSkyRateLimited(retry_after_seconds=600))

    assert (await run_cycle.run()).status == RunStatus.RATE_LIMITED
    assert run_cycle.rate_limited_until == NOW + timedelta(seconds=600)

    clock.now = NOW + timedelta(seconds=300)
    skipped = await run_cycle.run()
    assert skipped.status == RunStatus.SKIPPED
    assert "OpenSky credits" in (skipped.error or "")

    clock.now = NOW + timedelta(seconds=601)
    assert (await run_cycle.run()).status == RunStatus.RATE_LIMITED


async def test_a_429_without_delay_waits_one_period() -> None:
    run_cycle, _, _ = cycle(OpenSkyRateLimited(retry_after_seconds=None))

    await run_cycle.run()

    assert run_cycle.rate_limited_until == NOW + timedelta(seconds=30)


async def test_a_paused_collection_is_skipped() -> None:
    store = InMemoryCollectionStateStore()
    await store.set_paused(True, NOW, user_id=7)
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID]), store=store)

    result = await run_cycle.run()

    assert result.status == RunStatus.SKIPPED
    assert await store.last_success() is None


@pytest.mark.parametrize(
    ("error", "message"),
    [
        (NotImplementedError(), "Rules engine not implemented"),
        (RuntimeError("bug"), "RuntimeError('bug')"),
    ],
)
async def test_an_engine_failure_never_cancels_the_collection(
    error: Exception, message: str
) -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID]), Engine(error))

    result = await run_cycle.run()

    assert result.status == RunStatus.SUCCESS
    assert result.evaluation_error == message


async def test_a_broken_state_store_never_stops_the_cycle() -> None:
    store = InMemoryCollectionStateStore()
    store.record = AsyncMock(side_effect=RuntimeError("no table"))  # type: ignore[method-assign]
    store.pause_state = AsyncMock(side_effect=RuntimeError("no table"))  # type: ignore[method-assign]
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID]), store=store)

    assert (await run_cycle.run()).status == RunStatus.SUCCESS


async def test_the_memory_store_keeps_the_latest_runs_first() -> None:
    store = InMemoryCollectionStateStore(capacity=2)
    runs = [
        CollectionRunResult(NOW + timedelta(seconds=i), NOW, RunStatus.FAILED, "X")
        for i in range(3)
    ]
    for run in runs:
        await store.record(run)

    assert await store.runs(10) == [runs[2], runs[1]]
    assert await store.runs(1, offset=1) == [runs[1]]
    assert await store.last_success() is None


def test_the_dependency_gives_the_shared_store() -> None:
    assert get_state_store() is state_store


# Scheduler


def disabled_settings() -> OpenSkySettings:
    return OpenSkySettings(_env_file=None, COLLECTION_ENABLED=False)


def enabled_settings() -> OpenSkySettings:
    return OpenSkySettings(_env_file=None, COLLECTION_ENABLED=True)


async def test_a_disabled_scheduler_registers_itself_but_never_collects() -> None:
    scheduler = Scheduler(disabled_settings())

    await scheduler.start()
    try:
        assert Scheduler.current() is scheduler
        assert not scheduler.enabled
        assert scheduler.rate_limited_until is None
        with pytest.raises(CollectionDisabled):
            await scheduler.run_now()
    finally:
        await scheduler.stop()

    assert Scheduler.current() is None


async def test_an_enabled_scheduler_runs_cycles_on_demand() -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID]))
    scheduler = Scheduler(enabled_settings(), run_cycle)

    await scheduler.start()
    try:
        assert (await scheduler.run_now()).status == RunStatus.SUCCESS
        await scheduler._tick()
        assert not scheduler.busy
    finally:
        await scheduler.stop()


async def test_a_second_cycle_is_refused_while_one_runs() -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[]))
    scheduler = Scheduler(enabled_settings(), run_cycle)
    await scheduler.start()
    try:
        async with scheduler._lock:
            assert scheduler.busy
            with pytest.raises(CollectionBusy):
                await scheduler.run_now()
            await scheduler._tick()  # Skipped silently.
    finally:
        await scheduler.stop()


async def test_the_scheduler_builds_its_own_cycle_with_credentials() -> None:
    settings = OpenSkySettings(
        _env_file=None,
        COLLECTION_ENABLED=True,
        OPENSKY_CLIENT_ID="group",
        OPENSKY_CLIENT_SECRET="secret",
    )
    scheduler = Scheduler(settings)

    await scheduler.start()
    try:
        assert scheduler.settings is settings
        assert scheduler._cycle is not None
        assert scheduler._cycle._collector.authenticated
    finally:
        await scheduler.stop()


async def test_the_anonymous_scheduler_warns_about_the_quota() -> None:
    scheduler = Scheduler(enabled_settings())

    await scheduler.start()
    try:
        assert scheduler._cycle is not None
        assert not scheduler._cycle._collector.authenticated
    finally:
        await scheduler.stop()
