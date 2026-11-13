from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest

from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.aircraft import get_aircraft_service
from routes.v1.flights import get_flight_service
from schemas.aircraft import AircraftSummary
from schemas.flight import FlightDetail, FlightStatistics, FlightSummary, TrajectoryGap

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
AIRCRAFT = AircraftSummary(id="01JC0000000000000000000001", icao24="3c6444")
SUMMARY = FlightSummary(
    id="01JC0000000000000000000F01",
    aircraft_id=AIRCRAFT.id,
    icao24="3c6444",
    callsign="DLH4AB",
    started_at=T0,
)
DETAIL = FlightDetail(
    **SUMMARY.model_dump(),
    trajectory=[],
    gaps=[TrajectoryGap(start=T0, end=T0, duration_seconds=600)],
    statistics=FlightStatistics(observation_count=0, duration_seconds=0, distance_km=0),
)


class FakeFlightService:
    def __init__(self) -> None:
        self.limit: int | None = None
        self.at: datetime | None = None

    async def list_for_aircraft(
        self, _aircraft_id: str, limit: int = 50, at: datetime | None = None
    ) -> list[FlightSummary]:
        self.limit = limit
        self.at = at
        return [SUMMARY]

    async def get(self, public_id: str, at: datetime | None = None) -> FlightDetail | None:
        self.at = at
        return DETAIL if public_id == DETAIL.id else None


class FakeAircraftService:
    async def get(self, public_id: str, at: datetime | None = None) -> AircraftSummary | None:
        return AIRCRAFT if public_id == AIRCRAFT.id else None


@pytest.fixture
def flights() -> FakeFlightService:
    return FakeFlightService()


@pytest.fixture
async def api(flights: FakeFlightService) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def supervisor() -> CurrentUser:
        return CurrentUser(id=1, public_id="01JC0000000000000000000U01", role=RoleCode.SUPERVISOR)

    app.dependency_overrides[get_current_user] = supervisor
    app.dependency_overrides[get_flight_service] = lambda: flights
    app.dependency_overrides[get_aircraft_service] = FakeAircraftService
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


async def test_a_flight_needs_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"/api/v1/flights/{DETAIL.id}")).status_code == 401


async def test_a_supervisor_can_view_a_trajectory(api: httpx.AsyncClient) -> None:
    response = await api.get(f"/api/v1/flights/{DETAIL.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["callsign"] == "DLH4AB"
    assert body["gaps"][0]["duration_seconds"] == 600
    assert body["statistics"]["observation_count"] == 0


async def test_an_unknown_flight_is_not_found(api: httpx.AsyncClient) -> None:
    assert (await api.get("/api/v1/flights/01JC0000000000000000000F09")).status_code == 404


async def test_the_flights_of_an_aircraft_are_listed(
    api: httpx.AsyncClient, flights: FakeFlightService
) -> None:
    response = await api.get(f"/api/v1/aircraft/{AIRCRAFT.id}/flights", params={"limit": 5})

    assert response.status_code == 200
    assert response.json()[0]["id"] == SUMMARY.id
    assert flights.limit == 5


async def test_the_flights_of_an_unknown_aircraft_are_not_found(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/aircraft/01JC0000000000000000000009/flights")

    assert response.status_code == 404


async def test_the_flights_of_an_aircraft_need_an_authenticated_caller(
    client: httpx.AsyncClient,
) -> None:
    assert (await client.get(f"/api/v1/aircraft/{AIRCRAFT.id}/flights")).status_code == 401
