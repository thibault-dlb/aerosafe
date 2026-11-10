"""HTTP tests that run the real services on a fake database session.

The other API tests replace each service with a fake, so the service code is only covered by the
unit tests. These tests replace the database session instead: a request goes through the route,
the real service, its query building and its mapping of rows to schemas. Each query's result is
queued in the order the service reads it.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx
import pytest
from sqlalchemy.dialects import postgresql

from core.database import get_db
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from models import Aircraft, Alert, Flight

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
AIRCRAFT_ID = "01JC0000000000000000000001"
FLIGHT_ID = "01JC0000000000000000000F01"
ALERT_ID = "01JC00000000000000000000A1"
API = "/api/v1"


class FakeSession:
    """Answers each `execute` and `scalar` call with the next queued outcome."""

    def __init__(self, *outcomes: object) -> None:
        self.outcomes = list(outcomes)
        self.statements: list = []
        self.flushed = False
        self.committed = False

    async def execute(self, statement) -> object:
        self.statements.append(statement)
        return self.outcomes.pop(0)

    async def scalar(self, statement) -> object:
        self.statements.append(statement)
        return self.outcomes.pop(0)

    async def flush(self) -> None:
        self.flushed = True

    async def commit(self) -> None:
        self.committed = True

    def sql(self, index: int = 0) -> str:
        return str(self.statements[index].compile(dialect=postgresql.dialect()))


class FakeRow(SimpleNamespace):
    """A result row: the entity at index 0, the extra columns as attributes."""

    def __init__(self, entity: object, **columns: object) -> None:
        super().__init__(**columns)
        self._entity = entity

    def __getitem__(self, index: int) -> object:
        assert index == 0
        return self._entity


def result(*rows: object) -> MagicMock:
    outcome = MagicMock()
    outcome.all.return_value = list(rows)
    outcome.first.return_value = rows[0] if rows else None
    return outcome


def aircraft_row() -> FakeRow:
    aircraft = Aircraft(id=1, public_id=AIRCRAFT_ID, icao24="3c6444", registration="D-AIBD")
    return FakeRow(
        aircraft,
        model_label="A320",
        airline_label="Lufthansa",
        last_contact_at=T0,
        latitude=48.1,
        longitude=2.3,
    )


def flight_row() -> FakeRow:
    flight = Flight(
        id=7,
        public_id=FLIGHT_ID,
        aircraft_id=1,
        callsign="DLH4AB",
        started_at=T0,
        ended_at=T0 + timedelta(hours=1),
    )
    return FakeRow(
        flight,
        aircraft_public_id=AIRCRAFT_ID,
        icao24="3c6444",
        registration="D-AIBD",
        origin_label="Frankfurt",
        destination_label="Paris",
    )


def point_row(
    seconds: int, latitude: float | None, altitude: float | None = 10000, speed: float | None = 230
) -> SimpleNamespace:
    return SimpleNamespace(
        last_contact_at=T0 + timedelta(seconds=seconds),
        position_at=T0 + timedelta(seconds=seconds),
        latitude=latitude,
        longitude=None if latitude is None else 2.0,
        altitude=altitude,
        speed=speed,
        heading=90,
        on_ground=False,
        flight_public_id=FLIGHT_ID,
    )


def alert_row(processed: bool = False, observed_value: float | None = 12.5) -> FakeRow:
    alert = Alert(
        id=3,
        public_id=ALERT_ID,
        triggered_at=T0,
        episode_ended_at=None,
        observed_value=observed_value,
        threshold=10 if observed_value is not None else None,
        message="Position too old",
        processed_at=T0 if processed else None,
    )
    return FakeRow(
        alert,
        aircraft_public_id=AIRCRAFT_ID,
        icao24="3c6444",
        registration="D-AIBD",
        rule_code="R2",
        rule_description="Position too old",
        unit="s",
        criticality="HIGH",
    )


@pytest.fixture
def connect():
    """Open a client on the real application, with the caller and the database replaced."""

    @asynccontextmanager
    async def connected(session: FakeSession) -> AsyncGenerator[httpx.AsyncClient, None]:
        async def supervisor() -> CurrentUser:
            return CurrentUser(
                id=1, public_id="01JC0000000000000000000U01", role=RoleCode.SUPERVISOR
            )

        async def database() -> AsyncGenerator[FakeSession, None]:
            yield session

        app.dependency_overrides[get_current_user] = supervisor
        app.dependency_overrides[get_db] = database
        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                yield client
        finally:
            app.dependency_overrides.clear()

    return connected


async def test_the_aircraft_search_builds_its_query_and_maps_the_rows(connect) -> None:
    session = FakeSession(result(aircraft_row()))
    params = {
        "icao24": "3C64",
        "registration": "D-A",
        "airline": "Luft",
        "south": 40,
        "west": -5,
        "north": 52,
        "east": 10,
        "limit": 5,
    }

    async with connect(session) as client:
        response = await client.get(f"{API}/aircraft", params=params)

    assert response.status_code == 200
    [found] = response.json()
    assert (found["icao24"], found["model"], found["airline"]) == ("3c6444", "A320", "Lufthansa")
    assert (found["latitude"], found["longitude"]) == (48.1, 2.3)
    sql = session.sql()
    assert "ST_Intersects" in sql
    assert "ORDER BY" in sql


async def test_an_aircraft_record_is_found_by_its_public_identifier(connect) -> None:
    session = FakeSession(result(aircraft_row()), result())

    async with connect(session) as client:
        found = await client.get(f"{API}/aircraft/{AIRCRAFT_ID}")
        missing = await client.get(f"{API}/aircraft/01JC0000000000000000000009")

    assert found.status_code == 200
    assert found.json()["registration"] == "D-AIBD"
    assert missing.status_code == 404


async def test_the_observation_history_is_returned_oldest_first(connect) -> None:
    newest_first = result(point_row(60, 48.2), point_row(30, 48.1), point_row(0, 48.0))
    session = FakeSession(result(aircraft_row()), newest_first)

    async with connect(session) as client:
        response = await client.get(
            f"{API}/aircraft/{AIRCRAFT_ID}/observations",
            params={"start": T0.isoformat(), "end": (T0 + timedelta(hours=1)).isoformat()},
        )

    assert response.status_code == 200
    assert [point["latitude"] for point in response.json()] == [48.0, 48.1, 48.2]
    sql = session.sql(1)
    assert '"OBSERVATION"."DT_DERNIER_CONTACT" >=' in sql


async def test_the_flights_of_an_aircraft_are_listed_through_the_real_service(connect) -> None:
    session = FakeSession(result(aircraft_row()), result(flight_row()))

    async with connect(session) as client:
        response = await client.get(f"{API}/aircraft/{AIRCRAFT_ID}/flights", params={"limit": 5})

    assert response.status_code == 200
    [flight] = response.json()
    assert flight["id"] == FLIGHT_ID
    assert (flight["origin"], flight["destination"]) == ("Frankfurt", "Paris")


async def test_a_flight_comes_with_its_gaps_and_statistics(connect) -> None:
    points = result(
        point_row(0, 48.0, altitude=9000, speed=200),
        point_row(30, 48.1, altitude=None, speed=None),
        point_row(40, None),
        point_row(3600, 48.4, altitude=11000, speed=250),
    )
    session = FakeSession(result(flight_row()), points)

    async with connect(session) as client:
        response = await client.get(f"{API}/flights/{FLIGHT_ID}")

    assert response.status_code == 200
    body = response.json()
    assert len(body["trajectory"]) == 4
    assert len(body["gaps"]) == 1
    statistics = body["statistics"]
    assert statistics["observation_count"] == 4
    assert statistics["duration_seconds"] == 3600
    assert statistics["distance_km"] > 0


async def test_an_unknown_flight_is_a_404_through_the_real_service(connect) -> None:
    session = FakeSession(result())

    async with connect(session) as client:
        response = await client.get(f"{API}/flights/01JC0000000000000000000F09")

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("status", "sort", "order", "expected"),
    [
        ("active", "triggered_at", "desc", '"ALERTE"."DT_FIN_EPISODE" IS NULL'),
        ("unprocessed", "criticality", "asc", '"ALERTE"."DT_TRAITEMENT" IS NULL'),
        ("processed", "rule", "desc", '"ALERTE"."DT_TRAITEMENT" IS NOT NULL'),
    ],
)
async def test_the_alert_list_applies_every_filter_and_sort(
    connect, status: str, sort: str, order: str, expected: str
) -> None:
    session = FakeSession(1, result(alert_row()))
    params = {
        "rule": "R2",
        "status": status,
        "criticality": "HIGH",
        "icao24": "3C",
        "start": T0.isoformat(),
        "end": (T0 + timedelta(days=1)).isoformat(),
        "sort": sort,
        "order": order,
        "limit": 10,
        "offset": 5,
    }

    async with connect(session) as client:
        response = await client.get(f"{API}/alerts", params=params)

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 1
    assert page["items"][0]["rule_code"] == "R2"
    assert expected in session.sql(1)


async def test_an_alert_without_measure_has_no_observed_value_or_threshold(connect) -> None:
    session = FakeSession(0, result(alert_row(observed_value=None)))

    async with connect(session) as client:
        response = await client.get(f"{API}/alerts")

    [item] = response.json()["items"]
    assert (item["observed_value"], item["threshold"]) == (None, None)


async def test_an_alert_is_read_by_its_identifier(connect) -> None:
    session = FakeSession(result(alert_row()), result())

    async with connect(session) as client:
        found = await client.get(f"{API}/alerts/{ALERT_ID}")
        missing = await client.get(f"{API}/alerts/01JC00000000000000000000A9")

    assert found.status_code == 200
    assert found.json()["observed_value"] == 12.5
    assert missing.status_code == 404


async def test_processing_an_alert_records_the_supervisor_and_commits(connect) -> None:
    alert = alert_row()[0]
    session = FakeSession(alert, result(alert_row(processed=True)))

    async with connect(session) as client:
        response = await client.post(f"{API}/alerts/{ALERT_ID}/process")

    assert response.status_code == 200
    assert alert.processed_by_id == 1
    assert alert.processed_at is not None
    assert session.flushed and session.committed


async def test_processing_an_unknown_or_processed_alert_is_refused(connect) -> None:
    processed = alert_row(processed=True)[0]
    session = FakeSession(None, processed)

    async with connect(session) as client:
        unknown = await client.post(f"{API}/alerts/01JC00000000000000000000A9/process")
        again = await client.post(f"{API}/alerts/{ALERT_ID}/process")

    assert unknown.status_code == 404
    assert again.status_code == 409
    assert not session.committed


async def test_the_alert_statistics_count_the_alerts_per_rule(connect) -> None:
    session = FakeSession(result(("R1", 2), ("R3", 1)))

    async with connect(session) as client:
        response = await client.get(
            f"{API}/alerts/statistics",
            params={"start": T0.isoformat(), "end": (T0 + timedelta(hours=1)).isoformat()},
        )

    assert response.status_code == 200
    assert response.json()["total"] == 3
    assert response.json()["per_rule"] == {"R1": 2, "R3": 1}
