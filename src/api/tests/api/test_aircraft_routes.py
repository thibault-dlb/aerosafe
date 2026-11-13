from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest

from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.aircraft import get_aircraft_service, get_observation_reader
from schemas.aircraft import AircraftSummary, ObservationPoint
from services.aircraft import AircraftSearchCriteria, ObservationPeriod

AIRCRAFT = AircraftSummary(
    id="01JC0000000000000000000000",
    icao24="3c6444",
    registration="D-AIBD",
    model="Airbus A319",
    airline="Lufthansa",
    last_contact_at=datetime(2026, 11, 9, 10, 0, tzinfo=UTC),
    latitude=48.85,
    longitude=2.35,
)
POINT = ObservationPoint(
    last_contact_at=datetime(2026, 11, 9, 10, 0, tzinfo=UTC),
    latitude=48.85,
    longitude=2.35,
    altitude=10000.0,
    speed=230.0,
    heading=90.0,
    on_ground=False,
)


class FakeAircraftService:
    def __init__(self) -> None:
        self.criteria: AircraftSearchCriteria | None = None
        self.at: datetime | None = None

    async def search(self, criteria: AircraftSearchCriteria) -> list[AircraftSummary]:
        self.criteria = criteria
        return [AIRCRAFT]

    async def get(self, public_id: str, at: datetime | None = None) -> AircraftSummary | None:
        self.at = at
        return AIRCRAFT if public_id == AIRCRAFT.id else None


class FakeObservationReader:
    def __init__(self) -> None:
        self.period: ObservationPeriod | None = None

    async def history(self, _aircraft_id: str, period: ObservationPeriod) -> list[ObservationPoint]:
        self.period = period
        return [POINT]


@pytest.fixture
def service() -> FakeAircraftService:
    return FakeAircraftService()


@pytest.fixture
def reader() -> FakeObservationReader:
    return FakeObservationReader()


@pytest.fixture
async def api(
    service: FakeAircraftService, reader: FakeObservationReader
) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def user() -> CurrentUser:
        return CurrentUser(id=1, public_id="01JC0000000000000000000001", role=RoleCode.USER)

    app.dependency_overrides[get_current_user] = user
    app.dependency_overrides[get_aircraft_service] = lambda: service
    app.dependency_overrides[get_observation_reader] = lambda: reader
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


async def test_the_search_needs_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/aircraft")

    assert response.status_code == 401


async def test_the_record_needs_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    response = await client.get(f"/api/v1/aircraft/{AIRCRAFT.id}")

    assert response.status_code == 401


async def test_the_search_returns_the_matching_aircraft(
    api: httpx.AsyncClient, service: FakeAircraftService
) -> None:
    response = await api.get(
        "/api/v1/aircraft", params={"icao24": "3C64", "registration": "AIB", "airline": "Luft"}
    )

    assert response.status_code == 200
    assert response.json()[0]["id"] == AIRCRAFT.id
    assert response.json()[0]["latitude"] == 48.85
    assert service.criteria == AircraftSearchCriteria(
        icao24="3C64", registration="AIB", airline="Luft", limit=50
    )


async def test_the_search_passes_the_area(
    api: httpx.AsyncClient, service: FakeAircraftService
) -> None:
    response = await api.get(
        "/api/v1/aircraft",
        params={"south": 48.1, "west": 1.4, "north": 49.3, "east": 3.6, "limit": 10},
    )

    assert response.status_code == 200
    assert service.criteria is not None
    assert service.criteria.area is not None
    assert (service.criteria.area.south, service.criteria.area.east) == (48.1, 3.6)
    assert service.criteria.limit == 10


@pytest.mark.parametrize(
    "params",
    [
        {"south": 48.1, "west": 1.4},
        {"south": 49.3, "west": 1.4, "north": 48.1, "east": 3.6},
        {"icao24": "xyz"},
        {"icao24": "3c64441"},
        {"limit": 0},
        {"limit": 201},
        {"north": 91, "south": 0, "west": 0, "east": 1},
    ],
)
async def test_an_invalid_search_is_refused(api: httpx.AsyncClient, params: dict) -> None:
    response = await api.get("/api/v1/aircraft", params=params)

    assert response.status_code == 422


async def test_the_record_returns_the_aircraft(api: httpx.AsyncClient) -> None:
    response = await api.get(f"/api/v1/aircraft/{AIRCRAFT.id}")

    assert response.status_code == 200
    assert response.json()["registration"] == "D-AIBD"


async def test_an_unknown_aircraft_is_not_found(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/aircraft/01JC0000000000000000000009")

    assert response.status_code == 404


async def test_the_history_returns_the_flight_parameters(
    api: httpx.AsyncClient, reader: FakeObservationReader
) -> None:
    response = await api.get(
        f"/api/v1/aircraft/{AIRCRAFT.id}/observations",
        params={"start": "2026-11-09T09:00:00Z", "end": "2026-11-09T11:00:00Z", "limit": 10},
    )

    assert response.status_code == 200
    assert response.json()[0]["altitude"] == 10000.0
    assert reader.period == ObservationPeriod(
        start=datetime(2026, 11, 9, 9, 0, tzinfo=UTC),
        end=datetime(2026, 11, 9, 11, 0, tzinfo=UTC),
        limit=10,
    )


async def test_the_history_of_an_unknown_aircraft_is_not_found(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/aircraft/01JC0000000000000000000009/observations")

    assert response.status_code == 404


@pytest.mark.parametrize(
    "params",
    [
        {"start": "2026-11-09T11:00:00Z", "end": "2026-11-09T09:00:00Z"},
        {"limit": 0},
        {"limit": 5001},
        {"start": "yesterday"},
    ],
)
async def test_an_invalid_period_is_refused(api: httpx.AsyncClient, params: dict) -> None:
    response = await api.get(f"/api/v1/aircraft/{AIRCRAFT.id}/observations", params=params)

    assert response.status_code == 422


async def test_the_history_needs_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    response = await client.get(f"/api/v1/aircraft/{AIRCRAFT.id}/observations")

    assert response.status_code == 401
