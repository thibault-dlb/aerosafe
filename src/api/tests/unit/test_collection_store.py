from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy.dialects import postgresql

from models import Aircraft, Flight
from services.collection.flight_grouper import FlightGrouper
from services.collection.normalizer import NormalizedState
from services.collection.store import ObservationStore

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
GAP = timedelta(minutes=30)


class FakeSession:
    """Answers the queries of the store from lists, and records what the store writes."""

    def __init__(
        self,
        aircraft: list[Aircraft] | None = None,
        open_flights: list[Flight] | None = None,
        last_seen: list[tuple[int, datetime]] | None = None,
        stored: int = 1,
        rowcount: int | None = 0,
    ) -> None:
        self.aircraft = aircraft or []
        self.open_flights = open_flights or []
        self.last_seen = last_seen or []
        self.stored = stored
        self.rowcount = rowcount
        self.added: list[Flight] = []
        self.executed: list[tuple[object, object]] = []
        self.inserted_rows: list[dict] = []
        self.flushes = 0
        self._next_flight_id = 100

    async def execute(self, statement, params=None) -> SimpleNamespace:
        self.executed.append((statement, params))
        return SimpleNamespace(all=lambda: self.last_seen, rowcount=self.rowcount)

    async def scalars(self, statement, params=None):
        if params is not None:  # the insert of the observations
            self.inserted_rows = params
            return SimpleNamespace(all=lambda: list(range(self.stored)))
        entity = statement.column_descriptions[0]["entity"]
        return self.aircraft if entity is Aircraft else self.open_flights

    def add(self, flight: Flight) -> None:
        self.added.append(flight)

    async def flush(self) -> None:
        self.flushes += 1
        for flight in self.added:
            if flight.id is None:
                flight.id = self._next_flight_id
                self._next_flight_id += 1


def state(
    seconds: int = 0,
    callsign: str | None = "DLH4AB",
    latitude: float | None = 48.1,
    longitude: float | None = 2.3,
    icao24: str = "3c6444",
) -> NormalizedState:
    return NormalizedState(
        icao24=icao24,
        callsign=callsign,
        last_contact_at=T0 + timedelta(seconds=seconds),
        position_at=T0 + timedelta(seconds=seconds),
        latitude=latitude,
        longitude=longitude,
        altitude=Decimal("10000"),
        speed=Decimal("230"),
        heading=Decimal("90"),
        on_ground=False,
    )


def store_on(session: FakeSession) -> ObservationStore:
    return ObservationStore(session, FlightGrouper(GAP))


def known_aircraft() -> Aircraft:
    return Aircraft(id=1, icao24="3c6444", public_id="01JC0000000000000000000001")


def open_flight(callsign: str | None, started_minutes_ago: int = 20) -> Flight:
    return Flight(
        id=5,
        aircraft_id=1,
        callsign=callsign,
        started_at=T0 - timedelta(minutes=started_minutes_ago),
    )


async def test_nothing_is_stored_without_states() -> None:
    session = FakeSession()

    assert await store_on(session).save([]) == 0
    assert session.executed == []


async def test_the_first_sighting_creates_a_flight_and_stores_the_observation() -> None:
    session = FakeSession(aircraft=[known_aircraft()], stored=1)

    count = await store_on(session).save([state()])

    assert count == 1
    [flight] = session.added
    assert (flight.aircraft_id, flight.callsign, flight.started_at) == (1, "DLH4AB", T0)
    [row] = session.inserted_rows
    assert (row["aircraft_id"], row["flight_id"]) == (1, flight.id)
    assert row["last_contact_at"] == T0
    assert row["altitude"] == Decimal("10000")
    assert row["on_ground"] is False
    assert "POINT(2.3 48.1)" in str(row["position"].data)


async def test_the_new_aircraft_are_inserted_in_sorted_order_with_a_public_identifier() -> None:
    other = Aircraft(id=2, icao24="01020a", public_id="01JC0000000000000000000002")
    session = FakeSession(aircraft=[known_aircraft(), other])

    await store_on(session).save([state(icao24="3c6444"), state(icao24="01020a")])

    statement, rows = session.executed[0]
    assert [row["icao24"] for row in rows] == ["01020a", "3c6444"]
    assert all(len(row["public_id"]) == 26 for row in rows)
    assert "ON CONFLICT" in str(statement.compile(dialect=postgresql.dialect()))


async def test_a_state_without_position_stores_an_observation_without_geometry() -> None:
    session = FakeSession(aircraft=[known_aircraft()])

    await store_on(session).save([state(latitude=None, longitude=None)])

    assert session.inserted_rows[0]["position"] is None


async def test_the_observations_already_stored_are_not_counted() -> None:
    session = FakeSession(aircraft=[known_aircraft()], stored=0)

    assert await store_on(session).save([state()]) == 0


async def test_an_observation_joins_the_open_flight_and_fills_its_missing_callsign() -> None:
    flight = open_flight(callsign=None)
    session = FakeSession(
        aircraft=[known_aircraft()],
        open_flights=[flight],
        last_seen=[(5, T0 - timedelta(minutes=1))],
    )

    await store_on(session).save([state(callsign="DLH4AB")])

    assert session.added == []
    assert flight.callsign == "DLH4AB"
    assert session.inserted_rows[0]["flight_id"] == 5


async def test_an_open_flight_without_observation_is_dated_from_its_start() -> None:
    flight = open_flight(callsign="DLH4AB", started_minutes_ago=10)
    session = FakeSession(aircraft=[known_aircraft()], open_flights=[flight], last_seen=[])

    await store_on(session).save([state()])

    assert session.added == []
    assert session.inserted_rows[0]["flight_id"] == 5


async def test_a_new_callsign_closes_the_open_flight_and_starts_another() -> None:
    previous = open_flight(callsign="OLD1")
    last_seen = T0 - timedelta(minutes=1)
    session = FakeSession(
        aircraft=[known_aircraft()], open_flights=[previous], last_seen=[(5, last_seen)]
    )

    await store_on(session).save([state(callsign="DLH4AB")])

    assert previous.ended_at == last_seen
    [created] = session.added
    assert created.callsign == "DLH4AB"
    assert session.inserted_rows[0]["flight_id"] == created.id


async def test_a_long_silence_ends_the_flight_at_its_last_observation() -> None:
    previous = open_flight(callsign="DLH4AB", started_minutes_ago=120)
    last_seen = T0 - timedelta(minutes=90)
    session = FakeSession(
        aircraft=[known_aircraft()], open_flights=[previous], last_seen=[(5, last_seen)]
    )

    await store_on(session).save([state()])

    assert previous.ended_at == last_seen
    assert len(session.added) == 1


async def test_two_states_of_one_aircraft_share_the_flight_started_by_the_first() -> None:
    session = FakeSession(aircraft=[known_aircraft()], stored=2)

    count = await store_on(session).save([state(0), state(30)])

    assert count == 2
    assert len(session.added) == 1
    first, second = session.inserted_rows
    assert first["flight_id"] == second["flight_id"] == session.added[0].id


async def test_the_flights_are_flushed_once_before_the_observations_are_stored() -> None:
    session = FakeSession(aircraft=[known_aircraft()])

    await store_on(session).save([state()])

    assert session.flushes == 1


async def test_the_stale_flights_are_closed_with_one_update() -> None:
    session = FakeSession(rowcount=3)

    closed = await store_on(session).close_stale_flights(T0)

    assert closed == 3
    statement, _ = session.executed[0]
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert sql.startswith('UPDATE "VOL" SET')
    assert "max(" in sql.lower()


async def test_no_stale_flight_gives_zero_even_without_a_row_count() -> None:
    session = FakeSession(rowcount=None)

    assert await store_on(session).close_stale_flights(T0) == 0
