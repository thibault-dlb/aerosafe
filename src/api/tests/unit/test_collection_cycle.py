import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock

import pytest

from config.adsbfi import AdsbFiSettings
from config.opensky import OpenSkySettings
from core.data_mode import DataMode
from services.collection.collector import DataCollector
from services.collection.cycle import CollectionCycle
from services.collection.flight_grouper import FlightGrouper
from services.collection.opensky_client import (
    OpenSkyRateLimited,
    OpenSkyUnavailable,
    StatesResponse,
)
from services.collection.profiles import BoundingBox, CollectionProfile, ProfileCode
from services.collection.run_repository import get_state_store, state_store
from services.collection.run_state import (
    CollectionRunResult,
    InMemoryCollectionStateStore,
    RunStatus,
)
from services.collection.scheduler import (
    CollectionBusy,
    CollectionDisabled,
    CollectionRateLimited,
    Scheduler,
)
from services.collection.sources import AdsbFiSource, OpenSkySource

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
    def __init__(self, _session: Any, _grouper: FlightGrouper, _mode: DataMode) -> None:
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
        OpenSkySource(FakeClient(outcome)),  # type: ignore[arg-type]
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
        self.modes: list[DataMode] = []
        self.areas: list[Any] = []

    def __call__(self, _session: Any) -> "Engine":
        return self

    async def evaluate(self, now: datetime, mode: DataMode, area: Any = None) -> None:
        self.calls.append(now)
        self.areas.append(area)
        self.modes.append(mode)
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
    assert engine.modes == [DataMode.OPENSKY]
    assert engine.areas == [PROFILE.area]
    assert result.source is DataMode.OPENSKY
    assert await store.runs(10) == [result]
    assert await store.last_success() == result


async def test_the_run_ends_after_the_evaluation() -> None:
    class SlowEngine(Engine):
        def __init__(self, clock: Clock) -> None:
            super().__init__()
            self.clock = clock

        async def evaluate(self, now: datetime, mode: DataMode, area: Any = None) -> None:
            await super().evaluate(now, mode, area)
            self.clock.now = NOW + timedelta(seconds=7)

    clock = Clock()
    store = InMemoryCollectionStateStore()
    run_cycle = CollectionCycle(
        collector(StatesResponse(time=1, states=[VALID]), clock),
        store,
        session_factory=Sessions(),
        engine_factory=SlowEngine(clock),  # type: ignore[arg-type]
        clock=clock,
    )

    result = await run_cycle.run()

    assert (result.started_at, result.ended_at) == (NOW, NOW + timedelta(seconds=7))
    assert (await store.runs(1))[0].ended_at == NOW + timedelta(seconds=7)


async def test_rejected_states_make_a_partial_run() -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID, INVALID]))

    result = await run_cycle.run()

    assert (result.status, result.rejected) == (RunStatus.PARTIAL, 1)


async def test_a_state_that_is_not_a_list_is_counted_as_rejected() -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID, {"icao24": "3c6444"}]))

    result = await run_cycle.run()

    assert (result.status, result.received, result.rejected) == (RunStatus.PARTIAL, 2, 1)


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
    assert run_cycle.waiting_for_credits()
    waiting = await run_cycle.run()
    # Recorded as a 429 wait, not as a pause.
    assert waiting.status == RunStatus.RATE_LIMITED
    assert "Waiting for OpenSky credits" in (waiting.error or "")

    clock.now = NOW + timedelta(seconds=601)
    assert not run_cycle.waiting_for_credits()
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


async def test_a_manual_run_collects_even_when_paused() -> None:
    store = InMemoryCollectionStateStore()
    await store.set_paused(True, NOW, user_id=7)
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID]), store=store)

    assert (await run_cycle.run(manual=True)).status == RunStatus.SUCCESS


@pytest.mark.parametrize(
    ("error", "message"),
    [
        # A rule that is not finished is a failure like any other, not a missing engine.
        (NotImplementedError("R9"), "NotImplementedError('R9')"),
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
    assert await store.runs(1, before=runs[2].started_at) == [runs[1]]
    assert await store.last_success() is None


def test_the_dependency_gives_the_shared_store() -> None:
    assert get_state_store() is state_store


# Scheduler


def disabled_settings() -> OpenSkySettings:
    return OpenSkySettings(_env_file=None, COLLECTION_OPENSKY_ENABLED=False)


def enabled_settings() -> OpenSkySettings:
    return OpenSkySettings(_env_file=None, COLLECTION_OPENSKY_ENABLED=True)


async def test_a_disabled_scheduler_registers_itself_but_never_collects() -> None:
    scheduler = Scheduler(disabled_settings())

    await scheduler.start()
    try:
        assert Scheduler.current() is scheduler
        assert not scheduler.is_enabled()
        assert scheduler.rate_limited_until() is None
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
        assert not scheduler.is_busy()
    finally:
        await scheduler.stop()


async def test_a_second_cycle_is_refused_while_one_runs() -> None:
    run_cycle, _, _ = cycle(StatesResponse(time=1, states=[]))
    scheduler = Scheduler(enabled_settings(), run_cycle)
    await scheduler.start()
    try:
        async with scheduler._collections[DataMode.OPENSKY].lock:
            assert scheduler.is_busy()
            with pytest.raises(CollectionBusy):
                await scheduler.run_now()
            await scheduler._tick()  # Skipped silently.
    finally:
        await scheduler.stop()


async def test_a_manual_run_is_refused_while_waiting_for_credits() -> None:
    run_cycle, store, _ = cycle(OpenSkyRateLimited(retry_after_seconds=600))
    scheduler = Scheduler(enabled_settings(), run_cycle)
    await scheduler.start()
    try:
        await scheduler._tick()
        with pytest.raises(CollectionRateLimited) as error:
            await scheduler.run_now()
        assert error.value.until == NOW + timedelta(seconds=600)
        assert len(await store.runs(10)) == 1
    finally:
        await scheduler.stop()


async def test_the_scheduler_builds_its_own_cycle_with_credentials() -> None:
    settings = OpenSkySettings(
        _env_file=None,
        COLLECTION_OPENSKY_ENABLED=True,
        OPENSKY_CLIENT_ID="group",
        OPENSKY_CLIENT_SECRET="secret",
    )
    scheduler = Scheduler(settings)

    await scheduler.start()
    try:
        assert scheduler.settings is settings
        assert scheduler._collections[DataMode.OPENSKY].cycle is not None
        assert scheduler._collections[
            DataMode.OPENSKY
        ].cycle._collector.source._client.authenticated  # type: ignore[attr-defined]
    finally:
        await scheduler.stop()


async def test_stop_waits_for_the_running_cycle() -> None:
    run_cycle, store, _ = cycle(StatesResponse(time=1, states=[VALID]))
    release = asyncio.Event()
    collect = run_cycle._collector.run

    async def slow_run(session: Any, started_at: datetime) -> CollectionRunResult:
        await release.wait()
        return await collect(session, started_at)

    run_cycle._collector.run = slow_run  # type: ignore[method-assign]
    scheduler = Scheduler(enabled_settings(), run_cycle)
    await scheduler.start()
    running = asyncio.create_task(scheduler.run_now())
    await asyncio.sleep(0)
    assert scheduler.is_busy()

    stopping = asyncio.create_task(scheduler.stop())
    await asyncio.sleep(0)
    assert not stopping.done()

    release.set()
    await stopping
    assert (await running).status == RunStatus.SUCCESS
    assert len(await store.runs(10)) == 1


async def test_a_restarted_scheduler_builds_a_new_cycle() -> None:
    scheduler = Scheduler(enabled_settings())
    await scheduler.start()
    first = scheduler._collections[DataMode.OPENSKY].cycle
    await scheduler.stop()
    assert scheduler._collections[DataMode.OPENSKY].cycle is None

    await scheduler.start()
    try:
        assert (
            scheduler._collections[DataMode.OPENSKY].cycle is not None
            and scheduler._collections[DataMode.OPENSKY].cycle is not first
        )
        assert (
            scheduler._collections[DataMode.OPENSKY].http is not None
            and not scheduler._collections[DataMode.OPENSKY].http.is_closed
        )
    finally:
        await scheduler.stop()


async def test_the_anonymous_scheduler_warns_about_the_quota() -> None:
    scheduler = Scheduler(enabled_settings())

    await scheduler.start()
    try:
        assert scheduler._collections[DataMode.OPENSKY].cycle is not None
        assert not scheduler._collections[
            DataMode.OPENSKY
        ].cycle._collector.source._client.authenticated  # type: ignore[attr-defined]
    finally:
        await scheduler.stop()


def adsbfi_cycle(
    outcome: StatesResponse | Exception, store: InMemoryCollectionStateStore
) -> CollectionCycle:
    """A cycle labelled adsb.fi: the source only differs by its mode here."""

    class AdsbFiLike(OpenSkySource):
        @property
        def mode(self) -> DataMode:
            return DataMode.ADSBFI

    clock = Clock()
    return CollectionCycle(
        DataCollector(
            AdsbFiLike(FakeClient(outcome)),  # type: ignore[arg-type]
            PROFILE,
            FlightGrouper(timedelta(minutes=30)),
            store_factory=FakeStore,  # type: ignore[arg-type]
            clock=clock,
        ),
        store,
        session_factory=Sessions(),
        engine_factory=Engine(),  # type: ignore[arg-type]
        clock=clock,
    )


def both_enabled() -> tuple[OpenSkySettings, AdsbFiSettings]:
    return enabled_settings(), AdsbFiSettings(_env_file=None, COLLECTION_ADSBFI_ENABLED=True)


async def test_each_enabled_source_gets_its_own_periodic_job() -> None:
    opensky, adsbfi = both_enabled()
    scheduler = Scheduler(opensky, adsbfi_settings=adsbfi)

    await scheduler.start()
    try:
        assert scheduler._jobs is not None
        jobs = {job.id: job.trigger.interval.total_seconds() for job in scheduler._jobs.get_jobs()}
        assert jobs == {"collection-opensky": 30, "collection-adsbfi": 5}
        cycle = scheduler._collections[DataMode.ADSBFI].cycle
        assert cycle is not None and cycle.mode is DataMode.ADSBFI
        assert isinstance(cycle._collector.source, AdsbFiSource)
    finally:
        await scheduler.stop()

    assert scheduler._collections[DataMode.ADSBFI].cycle is None


async def test_adsbfi_alone_can_be_collected() -> None:
    adsbfi = AdsbFiSettings(_env_file=None, COLLECTION_ADSBFI_ENABLED=True)
    scheduler = Scheduler(disabled_settings(), adsbfi_settings=adsbfi)

    await scheduler.start()
    try:
        assert scheduler.is_enabled(DataMode.ADSBFI)
        assert not scheduler.is_enabled(DataMode.OPENSKY)
        assert scheduler._collections[DataMode.OPENSKY].cycle is None
        with pytest.raises(CollectionDisabled):
            await scheduler.run_now(DataMode.OPENSKY)
    finally:
        await scheduler.stop()


async def test_a_busy_source_never_blocks_the_other() -> None:
    store = InMemoryCollectionStateStore()
    opensky, adsbfi = both_enabled()
    opensky_cycle, _, _ = cycle(StatesResponse(time=1, states=[VALID]), store=store)
    scheduler = Scheduler(
        opensky,
        opensky_cycle,
        adsbfi_settings=adsbfi,
        adsbfi_cycle=adsbfi_cycle(StatesResponse(time=1, states=[VALID]), store),
    )
    await scheduler.start()
    try:
        async with scheduler._collections[DataMode.OPENSKY].lock:
            assert scheduler.is_busy(DataMode.OPENSKY)
            assert not scheduler.is_busy(DataMode.ADSBFI)
            result = await scheduler.run_now(DataMode.ADSBFI)
        assert (result.source, result.status) == (DataMode.ADSBFI, RunStatus.SUCCESS)
        await scheduler._tick(DataMode.ADSBFI)
        assert len(await store.runs(10, source=DataMode.ADSBFI)) == 2
        assert await store.runs(10) == []
    finally:
        await scheduler.stop()


async def test_a_rate_limited_adsbfi_refuses_a_manual_run() -> None:
    store = InMemoryCollectionStateStore()
    opensky, adsbfi = both_enabled()
    scheduler = Scheduler(
        opensky,
        adsbfi_settings=adsbfi,
        adsbfi_cycle=adsbfi_cycle(OpenSkyRateLimited(retry_after_seconds=60), store),
    )
    await scheduler.start()
    try:
        await scheduler._tick(DataMode.ADSBFI)
        with pytest.raises(CollectionRateLimited) as error:
            await scheduler.run_now(DataMode.ADSBFI)
        assert error.value.source is DataMode.ADSBFI
        assert scheduler.rate_limited_until(DataMode.ADSBFI) == NOW + timedelta(seconds=60)
        [waiting] = await store.runs(10, source=DataMode.ADSBFI)
        assert waiting.status == RunStatus.RATE_LIMITED
    finally:
        await scheduler.stop()


def test_the_replay_is_never_collected() -> None:
    scheduler = Scheduler(enabled_settings())

    assert not scheduler.is_enabled(DataMode.REPLAY)
    assert not scheduler.is_busy(DataMode.REPLAY)
    assert scheduler.rate_limited_until(DataMode.REPLAY) is None
