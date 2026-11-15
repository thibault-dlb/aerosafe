from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import httpx
import pytest

from core.data_mode import DataMode
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.dashboard import get_dashboard_service
from schemas.dashboard import (
    CollectionSummary,
    DashboardCounters,
    DashboardOut,
    DashboardStatisticsOut,
    StatisticsPeriod,
)
from services.dashboard.service import DashboardService
from services.replay import ReplayService, ReplayState
from services.replay.dependencies import get_replay_service
from tests.replay_support import REAL, T0, Clock, MemoryReplayStore

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)
COLLECTION = CollectionSummary(
    enabled=True, paused=False, running=False, recent_runs=[], remaining_credits=100
)
OVERVIEW = DashboardOut(
    counters=DashboardCounters(active_alerts=2, unprocessed_alerts=3, alerts_24h=5),
    active_alerts=[],
    collection=COLLECTION,
)
USER = CurrentUser(id=2, public_id="01JC0000000000000000000U02", role=RoleCode.USER)
SUPERVISOR = CurrentUser(id=7, public_id="01JC0000000000000000000U01", role=RoleCode.SUPERVISOR)


class FakeDashboard(DashboardService):
    def __init__(self) -> None:
        super().__init__(AsyncMock(), AsyncMock())  # every method is overridden: unused
        self.calls: list[tuple[str, DataMode | None, datetime | None]] = []

    async def overview(  # type: ignore[override]
        self,
        mode: DataMode,
        at: datetime | None,
        *,
        collection_enabled: bool,
        collection_running: bool,
    ) -> DashboardOut:
        self.calls.append(("overview", mode, at))
        return OVERVIEW

    async def collection(self, enabled: bool, running: bool) -> CollectionSummary:
        self.calls.append(("collection", None, None))
        return COLLECTION

    async def statistics(
        self, period: StatisticsPeriod, mode: DataMode, at: datetime | None
    ) -> DashboardStatisticsOut:
        self.calls.append((f"statistics {period}", mode, at))
        return self._slices(period, at or NOW, {})


def replay_at(state: ReplayState) -> None:
    replay = ReplayService(MemoryReplayStore(state), Clock())
    app.dependency_overrides[get_replay_service] = lambda: replay


@pytest.fixture
def dashboard() -> FakeDashboard:
    return FakeDashboard()


def build_client(user: CurrentUser, dashboard: FakeDashboard) -> httpx.AsyncClient:
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_dashboard_service] = lambda: dashboard
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def api(dashboard: FakeDashboard) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with build_client(USER, dashboard) as client:
        yield client
    app.dependency_overrides.clear()


async def test_the_dashboard_needs_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/v1/dashboard")).status_code == 401
    assert (await client.get("/api/v1/dashboard/statistics")).status_code == 401


async def test_an_ordinary_user_reads_the_dashboard(
    api: httpx.AsyncClient, dashboard: FakeDashboard
) -> None:
    response = await api.get("/api/v1/dashboard")

    assert response.status_code == 200
    assert response.json()["counters"] == {
        "active_alerts": 2,
        "unprocessed_alerts": 3,
        "alerts_24h": 5,
    }
    assert dashboard.calls == [("overview", DataMode.LIVE, None)]


async def test_a_supervisor_reads_it_too(dashboard: FakeDashboard) -> None:
    async with build_client(SUPERVISOR, dashboard) as client:
        response = await client.get("/api/v1/dashboard")
    app.dependency_overrides.clear()

    assert response.status_code == 200


async def test_a_replay_gives_its_mode_and_its_simulated_instant(
    api: httpx.AsyncClient, dashboard: FakeDashboard
) -> None:
    replay_at(ReplayState(T0, REAL, 1, False))

    response = await api.get("/api/v1/dashboard", params={"source": "replay"})

    assert response.status_code == 200
    mode, at = dashboard.calls[0][1:]
    assert mode is DataMode.REPLAY
    assert at is not None


async def test_a_replay_that_never_started_shows_nothing_but_the_collection(
    api: httpx.AsyncClient, dashboard: FakeDashboard
) -> None:
    replay_at(ReplayState(None, None, 1, False))

    response = await api.get("/api/v1/dashboard", params={"source": "replay"})

    assert response.status_code == 200
    assert response.json()["counters"]["active_alerts"] == 0
    assert dashboard.calls == [("collection", None, None)]


async def test_an_unknown_period_is_refused(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/dashboard/statistics", params={"period": "1y"})

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("period", "unit", "count"), [("24h", "hour", 24), ("7d", "day", 7), ("30d", "day", 30)]
)
async def test_the_statistics_follow_the_period(
    api: httpx.AsyncClient, dashboard: FakeDashboard, period: str, unit: str, count: int
) -> None:
    response = await api.get("/api/v1/dashboard/statistics", params={"period": period})

    assert response.status_code == 200
    body = response.json()
    assert (body["unit"], len(body["slices"])) == (unit, count)
    assert dashboard.calls == [(f"statistics {period}", DataMode.LIVE, None)]


async def test_the_statistics_default_to_the_last_day(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/dashboard/statistics")

    assert response.json()["period"] == "24h"


async def test_the_statistics_of_a_replay_that_never_started_are_empty(
    api: httpx.AsyncClient, dashboard: FakeDashboard
) -> None:
    replay_at(ReplayState(None, None, 1, False))

    response = await api.get(
        "/api/v1/dashboard/statistics", params={"source": "replay", "period": "7d"}
    )

    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert dashboard.calls == []
