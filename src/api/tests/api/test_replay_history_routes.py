"""History, flights and trajectories of a replay never go past the simulated instant."""

from collections.abc import AsyncGenerator
from datetime import timedelta

import httpx
import pytest

from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.aircraft import get_aircraft_service, get_observation_reader
from routes.v1.flights import get_flight_service
from services.replay import ReplayService, ReplayState
from services.replay.dependencies import get_replay_service
from tests.api.test_aircraft_routes import AIRCRAFT, FakeAircraftService, FakeObservationReader
from tests.api.test_flights_routes import DETAIL, FakeFlightService
from tests.replay_support import REAL, T0, Clock, MemoryReplayStore


@pytest.fixture
def reader() -> FakeObservationReader:
    return FakeObservationReader()


@pytest.fixture
def flights() -> FakeFlightService:
    return FakeFlightService()


@pytest.fixture
async def client(
    reader: FakeObservationReader, flights: FakeFlightService
) -> AsyncGenerator[httpx.AsyncClient, None]:
    replay = ReplayService(MemoryReplayStore(ReplayState(T0, REAL, 1, True)), Clock())
    app.dependency_overrides[get_replay_service] = lambda: replay
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        5, new_ulid(), RoleCode.SUPERVISOR
    )
    app.dependency_overrides[get_aircraft_service] = FakeAircraftService
    app.dependency_overrides[get_observation_reader] = lambda: reader
    app.dependency_overrides[get_flight_service] = lambda: flights
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


def observations(aircraft_id: str = AIRCRAFT.id) -> str:
    return f"/api/v1/aircraft/{aircraft_id}/observations"


class TestObservationHistory:
    async def test_a_replay_history_ends_at_the_instant(
        self, client: httpx.AsyncClient, reader: FakeObservationReader
    ) -> None:
        response = await client.get(observations(), params={"source": "replay"})

        assert response.status_code == 200
        assert reader.period.end == T0

    async def test_an_end_before_the_instant_is_kept(
        self, client: httpx.AsyncClient, reader: FakeObservationReader
    ) -> None:
        earlier = T0 - timedelta(minutes=5)

        await client.get(observations(), params={"source": "replay", "end": earlier.isoformat()})

        assert reader.period.end == earlier

    async def test_an_end_after_the_instant_is_brought_back_to_it(
        self, client: httpx.AsyncClient, reader: FakeObservationReader
    ) -> None:
        later = T0 + timedelta(hours=2)

        await client.get(observations(), params={"source": "replay", "end": later.isoformat()})

        assert reader.period.end == T0

    async def test_the_live_history_is_not_bounded(
        self, client: httpx.AsyncClient, reader: FakeObservationReader
    ) -> None:
        await client.get(observations())

        assert reader.period.end is None


class TestFlights:
    async def test_the_flights_of_a_replay_are_those_started_before_the_instant(
        self, client: httpx.AsyncClient, flights: FakeFlightService
    ) -> None:
        response = await client.get(
            f"/api/v1/aircraft/{AIRCRAFT.id}/flights", params={"source": "replay"}
        )

        assert response.status_code == 200
        assert flights.at == T0

    async def test_the_live_flights_have_no_instant(
        self, client: httpx.AsyncClient, flights: FakeFlightService
    ) -> None:
        await client.get(f"/api/v1/aircraft/{AIRCRAFT.id}/flights")

        assert flights.at is None

    async def test_the_trajectory_of_a_replay_flight_stops_at_the_instant(
        self, client: httpx.AsyncClient, flights: FakeFlightService
    ) -> None:
        response = await client.get(f"/api/v1/flights/{DETAIL.id}", params={"source": "replay"})

        assert response.status_code == 200
        assert flights.at == T0

    async def test_a_live_trajectory_is_whole(
        self, client: httpx.AsyncClient, flights: FakeFlightService
    ) -> None:
        await client.get(f"/api/v1/flights/{DETAIL.id}")

        assert flights.at is None
