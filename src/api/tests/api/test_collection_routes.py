from collections.abc import AsyncGenerator
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from config.adsbfi import AdsbFiSettings
from config.opensky import OpenSkySettings
from core.data_mode import DataMode
from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.collection import get_scheduler
from services.collection.run_repository import get_state_store
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

NOW = datetime(2026, 11, 9, 12, tzinfo=UTC)
RUN = CollectionRunResult(NOW, NOW, RunStatus.SUCCESS, "ILE_DE_FRANCE", 3, 3, 0, 390)


class FakeScheduler(Scheduler):
    def __init__(self, outcome: CollectionRunResult | Exception) -> None:
        super().__init__(OpenSkySettings(_env_file=None, COLLECTION_OPENSKY_ENABLED=True))
        self.outcome = outcome

        self.sources: list[DataMode] = []

    async def run_now(self, source: DataMode = DataMode.OPENSKY) -> CollectionRunResult:
        self.sources.append(source)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


@pytest.fixture
def store() -> InMemoryCollectionStateStore:
    return InMemoryCollectionStateStore()


@pytest.fixture
async def client(store: InMemoryCollectionStateStore) -> AsyncGenerator[httpx.AsyncClient, None]:
    app.dependency_overrides[get_state_store] = lambda: store
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        5, new_ulid(), RoleCode.SUPERVISOR
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


def use_scheduler(scheduler: Scheduler) -> None:
    app.dependency_overrides[get_scheduler] = lambda: scheduler


async def test_the_status_describes_the_collection(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    await store.record(RUN)
    use_scheduler(Scheduler(OpenSkySettings(_env_file=None)))

    response = await client.get("/api/v1/collection/status")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["paused"] is False
    assert body["profile"] == "ILE_DE_FRANCE"
    assert (body["period_seconds"], body["credits_per_day"], body["daily_quota"]) == (
        30,
        2_880,
        400,
    )
    assert body["last_run"]["remaining_credits"] == 390
    assert body["last_success"]["status"] == "SUCCESS"


async def test_the_status_works_without_any_run(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/collection/status")

    assert response.status_code == 200
    assert response.json()["last_run"] is None


async def test_runs_are_listed_newest_first_with_paging(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    for stored in range(3):
        started_at = NOW + timedelta(minutes=stored)
        await store.record(
            CollectionRunResult(started_at, started_at, RunStatus.SUCCESS, "X", stored=stored)
        )

    first = (await client.get("/api/v1/collection/runs", params={"limit": 2})).json()
    after = first[-1]["started_at"]
    second = (
        await client.get("/api/v1/collection/runs", params={"limit": 2, "before": after})
    ).json()

    assert [run["stored"] for run in first] == [2, 1]
    assert [run["stored"] for run in second] == [0]


async def test_the_page_size_is_bounded(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/collection/runs", params={"limit": 500})

    assert response.status_code == 422


async def test_a_manual_run_returns_its_result(client: httpx.AsyncClient) -> None:
    use_scheduler(FakeScheduler(RUN))

    response = await client.post("/api/v1/collection/run")

    assert response.status_code == 200
    assert response.json()["stored"] == 3


@pytest.mark.parametrize(
    "error", [CollectionDisabled(), CollectionBusy(), CollectionRateLimited(NOW)]
)
async def test_a_manual_run_conflicts_when_impossible(
    client: httpx.AsyncClient, error: Exception
) -> None:
    use_scheduler(FakeScheduler(error))

    assert (await client.post("/api/v1/collection/run")).status_code == 409


async def test_pause_and_resume_are_kept_with_their_author(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    paused = await client.post("/api/v1/collection/pause")

    assert paused.json()["paused"] is True
    assert paused.json()["paused_at"] is not None
    assert (await store.pause_state()).changed_by == 5

    resumed = await client.post("/api/v1/collection/resume")
    assert resumed.json()["paused"] is False
    assert resumed.json()["paused_at"] is None


async def test_a_user_cannot_drive_the_collection(client: httpx.AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(6, new_ulid(), RoleCode.USER)

    for method, path in [("GET", "status"), ("GET", "runs"), ("POST", "pause")]:
        response = await client.request(method, f"/api/v1/collection/{path}")
        assert response.status_code == 403


def test_without_a_started_scheduler_a_stopped_one_is_used() -> None:
    assert Scheduler.current() is None
    assert isinstance(get_scheduler(), Scheduler)


async def test_the_status_of_adsbfi_has_no_credits(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    await store.record(replace(RUN, source=DataMode.ADSBFI, remaining_credits=None))
    use_scheduler(
        Scheduler(
            OpenSkySettings(_env_file=None),
            adsbfi_settings=AdsbFiSettings(_env_file=None, COLLECTION_ADSBFI_ENABLED=True),
        )
    )

    body = (await client.get("/api/v1/collection/status", params={"source": "adsbfi"})).json()

    assert (body["source"], body["enabled"], body["profile"]) == ("adsbfi", True, "ADSBFI_250NM")
    assert (body["period_seconds"], body["credits_per_day"]) == (5, 0)
    assert (body["daily_quota"], body["authenticated"]) == (None, None)
    assert body["last_run"]["source"] == "adsbfi"


async def test_the_runs_of_each_source_are_listed_apart(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    await store.record(RUN)
    await store.record(replace(RUN, source=DataMode.ADSBFI, stored=7))

    runs = (await client.get("/api/v1/collection/runs", params={"source": "adsbfi"})).json()

    assert [run["stored"] for run in runs] == [7]


async def test_a_manual_run_runs_the_source_asked(client: httpx.AsyncClient) -> None:
    scheduler = FakeScheduler(RUN)
    use_scheduler(scheduler)

    await client.post("/api/v1/collection/run", params={"source": "adsbfi"})

    assert scheduler.sources == [DataMode.ADSBFI]


async def test_each_source_is_paused_on_its_own(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    paused = await client.post("/api/v1/collection/pause", params={"source": "adsbfi"})

    assert paused.json()["paused"] is True
    assert (await store.pause_state(DataMode.ADSBFI)).paused is True
    assert (await store.pause_state(DataMode.OPENSKY)).paused is False


async def test_the_replay_is_not_a_collection(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/collection/status", params={"source": "replay"})

    assert response.status_code == 422


def test_a_rate_limited_adsbfi_says_so() -> None:
    error = CollectionRateLimited(NOW, DataMode.ADSBFI)

    assert str(error).startswith("adsb.fi refuses requests until")
    assert error.source is DataMode.ADSBFI
