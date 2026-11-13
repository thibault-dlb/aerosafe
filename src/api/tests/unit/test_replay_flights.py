"""Flights and trajectories at the simulated instant of a replay."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.dialects import postgresql

from models import Flight
from services.aircraft import ObservationReader
from services.flights import FlightService

START = datetime(2022, 8, 14, 15, 0, tzinfo=UTC)
AT = START + timedelta(minutes=10)


class FakeRow(SimpleNamespace):
    def __init__(self, flight: Flight, **columns) -> None:
        super().__init__(**columns)
        self._flight = flight

    def __getitem__(self, index: int) -> Flight:
        assert index == 0
        return self._flight


def flight_row(ended_at: datetime | None) -> FakeRow:
    flight = Flight(
        id=7,
        public_id="01JC0000000000000000000F01",
        aircraft_id=1,
        started_at=START,
        ended_at=ended_at,
    )
    return FakeRow(
        flight,
        aircraft_public_id="01JC0000000000000000000001",
        icao24="000001",
        registration=None,
        origin_label=None,
        destination_label=None,
    )


def service_returning(rows: list) -> tuple[FlightService, AsyncMock]:
    result = MagicMock()
    result.all.return_value = rows
    result.first.return_value = rows[0] if rows else None
    session = AsyncMock()
    session.execute.return_value = result
    return FlightService(session), session


def compiled(statement):
    return statement.compile(dialect=postgresql.dialect())


class TestFlightList:
    def test_a_flight_that_starts_after_the_instant_is_left_out(self) -> None:
        query = compiled(FlightService(AsyncMock()).list_query("id", 20, AT))

        assert '"VOL"."DT_DEBUT" <=' in str(query)
        assert AT in query.params.values()

    def test_without_an_instant_the_list_has_no_bound(self) -> None:
        query = compiled(FlightService(AsyncMock()).list_query("id", 20))

        assert '"VOL"."DT_DEBUT" <=' not in str(query)

    async def test_a_flight_that_ends_after_the_instant_is_still_in_progress(self) -> None:
        service, _ = service_returning([flight_row(AT + timedelta(minutes=5))])

        [summary] = await service.list_for_aircraft("id", 20, AT)

        assert summary.ended_at is None

    async def test_a_flight_that_ended_before_the_instant_keeps_its_end(self) -> None:
        ended = AT - timedelta(minutes=5)
        service, _ = service_returning([flight_row(ended)])

        [summary] = await service.list_for_aircraft("id", 20, AT)

        assert summary.ended_at == ended

    async def test_without_an_instant_the_end_is_the_stored_one(self) -> None:
        ended = AT + timedelta(days=1)
        service, _ = service_returning([flight_row(ended)])

        [summary] = await service.list_for_aircraft("id", 20)

        assert summary.ended_at == ended


class TestFlightDetail:
    async def test_the_trajectory_stops_at_the_instant(self, monkeypatch) -> None:
        service, session = service_returning([flight_row(AT + timedelta(minutes=5))])
        points = AsyncMock(return_value=[])
        monkeypatch.setattr(service._observations, "flight", points)

        detail = await service.get("01JC0000000000000000000F01", AT)

        points.assert_awaited_once_with(7, AT)
        assert detail is not None and detail.ended_at is None
        assert '"VOL"."DT_DEBUT" <=' in str(compiled(session.execute.await_args.args[0]))

    async def test_a_flight_that_has_not_started_yet_does_not_exist(self) -> None:
        service, _ = service_returning([])

        assert await service.get("01JC0000000000000000000F01", AT) is None


class TestTrajectoryQuery:
    def test_the_points_stop_at_the_instant(self) -> None:
        query = compiled(ObservationReader(AsyncMock()).flight_query(7, at=AT))

        assert '"OBSERVATION"."DT_DERNIER_CONTACT" <=' in str(query)
        assert AT in query.params.values()

    def test_without_an_instant_the_trajectory_is_whole(self) -> None:
        query = compiled(ObservationReader(AsyncMock()).flight_query(7))

        assert '"DT_DERNIER_CONTACT" <=' not in str(query)

    async def test_the_reader_gives_the_instant_to_the_query(self) -> None:
        session = AsyncMock()
        result = MagicMock()
        result.all.return_value = []
        session.execute.return_value = result

        assert await ObservationReader(session).flight(7, AT) == []

        assert AT in compiled(session.execute.await_args.args[0]).params.values()
