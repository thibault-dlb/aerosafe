"""`?source=replay` on the aircraft and alert routes: the instant of the shared clock."""

from collections.abc import AsyncGenerator
from datetime import timedelta

import httpx
import pytest

from core.data_mode import DataMode
from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.aircraft import get_aircraft_service, get_observation_reader
from routes.v1.alerts import get_alert_service
from services.replay import ReplayService, ReplayState
from services.replay.dependencies import get_replay_service
from tests.api.test_aircraft_routes import AIRCRAFT, FakeAircraftService, FakeObservationReader
from tests.api.test_alerts_routes import FakeAlertService
from tests.replay_support import REAL, T0, Clock, MemoryReplayStore

SUPERVISOR = CurrentUser(5, new_ulid(), RoleCode.SUPERVISOR)


@pytest.fixture
def aircraft() -> FakeAircraftService:
    return FakeAircraftService()


@pytest.fixture
def alerts() -> FakeAlertService:
    return FakeAlertService()


def run_replay(state: ReplayState) -> Clock:
    clock = Clock()
    replay = ReplayService(MemoryReplayStore(state), clock)
    app.dependency_overrides[get_replay_service] = lambda: replay
    return clock


@pytest.fixture
async def client(
    aircraft: FakeAircraftService, alerts: FakeAlertService
) -> AsyncGenerator[httpx.AsyncClient, None]:
    app.dependency_overrides[get_current_user] = lambda: SUPERVISOR
    app.dependency_overrides[get_aircraft_service] = lambda: aircraft
    app.dependency_overrides[get_observation_reader] = lambda: FakeObservationReader()
    app.dependency_overrides[get_alert_service] = lambda: alerts
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


class TestAircraft:
    async def test_the_search_is_live_by_default(
        self, client: httpx.AsyncClient, aircraft: FakeAircraftService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, False))

        await client.get("/api/v1/aircraft")

        assert aircraft.criteria.mode is DataMode.LIVE
        assert aircraft.criteria.at is None

    async def test_a_replay_search_is_made_at_the_instant_of_the_clock(
        self, client: httpx.AsyncClient, aircraft: FakeAircraftService
    ) -> None:
        clock = run_replay(ReplayState(T0, REAL, 10, False))
        clock.advance(timedelta(seconds=6))

        response = await client.get("/api/v1/aircraft", params={"source": "replay"})

        assert response.status_code == 200
        assert aircraft.criteria.mode is DataMode.REPLAY
        assert aircraft.criteria.at == T0 + timedelta(seconds=60)

    async def test_a_replay_that_never_started_lists_nothing(
        self, client: httpx.AsyncClient, aircraft: FakeAircraftService
    ) -> None:
        run_replay(ReplayState())

        response = await client.get("/api/v1/aircraft", params={"source": "replay"})

        assert response.json() == []
        assert aircraft.criteria is None

    async def test_an_invalid_area_is_still_refused_in_a_replay(
        self, client: httpx.AsyncClient
    ) -> None:
        run_replay(ReplayState())

        response = await client.get(
            "/api/v1/aircraft", params={"source": "replay", "south": 10, "west": 1}
        )

        assert response.status_code == 422

    async def test_an_unknown_source_is_refused(self, client: httpx.AsyncClient) -> None:
        run_replay(ReplayState())

        assert (
            await client.get("/api/v1/aircraft", params={"source": "tomorrow"})
        ).status_code == 422

    async def test_the_record_is_read_at_the_instant_of_the_replay(
        self, client: httpx.AsyncClient, aircraft: FakeAircraftService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, True))

        response = await client.get(f"/api/v1/aircraft/{AIRCRAFT.id}", params={"source": "replay"})

        assert response.status_code == 200
        assert aircraft.at == T0

    async def test_a_live_record_has_no_instant(
        self, client: httpx.AsyncClient, aircraft: FakeAircraftService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, True))

        await client.get(f"/api/v1/aircraft/{AIRCRAFT.id}")

        assert aircraft.at is None


class TestAlerts:
    async def test_a_replay_list_is_limited_to_the_instant_of_the_clock(
        self, client: httpx.AsyncClient, alerts: FakeAlertService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, True))

        response = await client.get("/api/v1/alerts", params={"source": "replay"})

        assert response.status_code == 200
        assert (alerts.filters.mode, alerts.filters.at) == (DataMode.REPLAY, T0)

    async def test_the_list_is_live_by_default(
        self, client: httpx.AsyncClient, alerts: FakeAlertService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, True))

        await client.get("/api/v1/alerts")

        assert (alerts.filters.mode, alerts.filters.at) == (DataMode.LIVE, None)

    async def test_a_replay_that_never_started_has_no_alert(
        self, client: httpx.AsyncClient, alerts: FakeAlertService
    ) -> None:
        run_replay(ReplayState())

        body = (await client.get("/api/v1/alerts", params={"source": "replay"})).json()

        assert body == {"items": [], "total": 0}
        assert alerts.filters is None

    async def test_the_statistics_of_a_replay_end_at_its_instant(
        self, client: httpx.AsyncClient, alerts: FakeAlertService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, True))

        body = (await client.get("/api/v1/alerts/statistics", params={"source": "replay"})).json()

        assert alerts.period == (T0 - timedelta(hours=24), T0)
        assert alerts.mode is DataMode.REPLAY
        assert body["total"] == 3

    async def test_the_live_statistics_keep_the_clock_of_the_server(
        self, client: httpx.AsyncClient, alerts: FakeAlertService
    ) -> None:
        run_replay(ReplayState(T0, REAL, 1, True))

        await client.get("/api/v1/alerts/statistics")

        start, end = alerts.period
        assert end - start == timedelta(hours=24)
        assert end > T0 + timedelta(days=365)
        assert alerts.mode is DataMode.LIVE

    async def test_the_statistics_of_a_replay_that_never_started_are_empty(
        self, client: httpx.AsyncClient, alerts: FakeAlertService
    ) -> None:
        run_replay(ReplayState())

        body = (await client.get("/api/v1/alerts/statistics", params={"source": "replay"})).json()

        assert (body["total"], body["per_rule"]) == (0, {})
        assert alerts.period is None
