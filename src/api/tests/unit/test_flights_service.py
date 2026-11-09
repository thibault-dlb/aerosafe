from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.dialects import postgresql

from models import Flight
from schemas.aircraft import ObservationPoint
from services.flights import FlightService

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
AIRCRAFT_ID = "01JC0000000000000000000001"
FLIGHT_ID = "01JC0000000000000000000F01"


class FakeRow(SimpleNamespace):
    def __init__(self, flight: Flight, **columns) -> None:
        super().__init__(**columns)
        self._flight = flight

    def __getitem__(self, index: int) -> Flight:
        assert index == 0
        return self._flight


def flight_row() -> FakeRow:
    flight = Flight(
        id=7,
        public_id=FLIGHT_ID,
        aircraft_id=1,
        callsign="DLH4AB",
        started_at=T0,
        ended_at=T0 + timedelta(minutes=1),
    )
    return FakeRow(
        flight,
        aircraft_public_id=AIRCRAFT_ID,
        icao24="3c6444",
        registration="D-AIBD",
        origin_label="Frankfurt",
        destination_label=None,
    )


def point(seconds: int, latitude: float) -> ObservationPoint:
    return ObservationPoint(
        last_contact_at=T0 + timedelta(seconds=seconds),
        latitude=latitude,
        longitude=2.0,
        altitude=10000.0,
        speed=230.0,
        on_ground=False,
    )


def service_returning(rows: list) -> tuple[FlightService, AsyncMock]:
    result = MagicMock()
    result.all.return_value = rows
    result.first.return_value = rows[0] if rows else None
    session = AsyncMock()
    session.execute.return_value = result
    return FlightService(session), session


def sql(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


def test_flights_of_deleted_aircraft_or_deleted_flights_are_hidden() -> None:
    query = sql(FlightService(AsyncMock()).summary_query())

    assert '"VOL".deleted_at IS NULL' in query
    assert '"AERONEF".deleted_at IS NULL' in query
    assert 'LEFT OUTER JOIN "R_AEROPORT" AS origin' in query
    assert 'LEFT OUTER JOIN "R_AEROPORT" AS destination' in query


def test_the_flights_of_an_aircraft_are_listed_most_recent_first() -> None:
    query = sql(FlightService(AsyncMock()).list_query(AIRCRAFT_ID, 20))

    assert '"AERONEF"."CD_ULID" =' in query
    assert 'ORDER BY "VOL"."DT_DEBUT" DESC' in query


async def test_list_maps_rows_to_summaries() -> None:
    service, _ = service_returning([flight_row()])

    [summary] = await service.list_for_aircraft(AIRCRAFT_ID)

    assert summary.id == FLIGHT_ID
    assert summary.aircraft_id == AIRCRAFT_ID
    assert summary.callsign == "DLH4AB"
    assert (summary.origin, summary.destination) == ("Frankfurt", None)


async def test_get_adds_the_trajectory_gaps_and_statistics() -> None:
    service, _ = service_returning([flight_row()])
    trajectory = [point(0, 48.0), point(30, 48.1), point(60, 48.2)]
    service._observations = AsyncMock()
    service._observations.flight.return_value = trajectory

    detail = await service.get(FLIGHT_ID)

    assert detail is not None
    service._observations.flight.assert_awaited_once_with(7)
    assert detail.trajectory == trajectory
    assert detail.gaps == []
    assert detail.statistics.observation_count == 3
    assert detail.statistics.duration_seconds == 60


async def test_get_returns_none_for_an_unknown_flight() -> None:
    service, _ = service_returning([])

    assert await service.get("unknown") is None


def test_a_flight_trajectory_is_read_oldest_first() -> None:
    from services.aircraft import ObservationReader

    query = sql(ObservationReader(AsyncMock()).flight_query(7))

    assert '"OBSERVATION"."ID_VOL" =' in query
    assert 'ORDER BY "OBSERVATION"."DT_DERNIER_CONTACT"' in query
    assert "DESC" not in query.split("ORDER BY")[1]


async def test_the_reader_maps_the_flight_points() -> None:
    from services.aircraft import ObservationReader

    result = MagicMock()
    result.all.return_value = [
        SimpleNamespace(
            last_contact_at=T0,
            position_at=T0,
            latitude=48.0,
            longitude=2.0,
            altitude=None,
            speed=None,
            heading=None,
            on_ground=True,
            flight_public_id=FLIGHT_ID,
        )
    ]
    session = AsyncMock()
    session.execute.return_value = result

    [only] = await ObservationReader(session).flight(7)

    assert only.on_ground is True
    assert only.flight_id == FLIGHT_ID
