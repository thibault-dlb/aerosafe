from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest

from config.opensky import OpenSkySettings
from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.collection import get_scheduler
from services.collection.run_state import (
    CollectionRunResult,
    InMemoryCollectionStateStore,
    RunStatus,
    get_state_store,
)
from services.collection.scheduler import CollectionBusy, CollectionDisabled, Scheduler

NOW = datetime(2026, 11, 9, 12, tzinfo=UTC)
RUN = CollectionRunResult(NOW, NOW, RunStatus.SUCCESS, "ILE_DE_FRANCE", 3, 3, 0, 390)


class FakeScheduler(Scheduler):
    def __init__(self, outcome: CollectionRunResult | Exception) -> None:
        super().__init__(OpenSkySettings(_env_file=None, COLLECTION_ENABLED=True))
        self.outcome = outcome

    async def run_now(self) -> CollectionRunResult:
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
        await store.record(CollectionRunResult(NOW, NOW, RunStatus.SUCCESS, "X", stored=stored))

    response = await client.get("/api/v1/collection/runs", params={"limit": 2, "offset": 1})

    assert [run["stored"] for run in response.json()] == [1, 0]


async def test_the_page_size_is_bounded(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/collection/runs", params={"limit": 500})

    assert response.status_code == 422


async def test_a_manual_run_returns_its_result(client: httpx.AsyncClient) -> None:
    use_scheduler(FakeScheduler(RUN))

    response = await client.post("/api/v1/collection/run")

    assert response.status_code == 200
    assert response.json()["stored"] == 3


@pytest.mark.parametrize("error", [CollectionDisabled(), CollectionBusy()])
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
