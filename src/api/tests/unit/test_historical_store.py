import re
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy.dialects import postgresql

from core.models import ULID_PATTERN
from services.historical.prc2024 import ObservationBatch
from services.historical.store import (
    _INSERT_OBSERVATIONS,
    HistoricalStore,
    HistoricalUnitOfWork,
    NewFlight,
    from_microseconds,
    to_microseconds,
)


def result(rows: list[tuple] | None = None, rowcount: int = 0) -> SimpleNamespace:
    return SimpleNamespace(all=lambda: rows or [], rowcount=rowcount)


class FakeSession:
    """Answers the store from a queue of results and records what it was asked."""

    def __init__(self, results: list[SimpleNamespace] | None = None, scalar: object = None) -> None:
        self.results = list(results or [])
        self.scalar_value = scalar
        self.executed: list[tuple[object, object]] = []

    async def execute(self, statement: object, params: object = None) -> SimpleNamespace:
        self.executed.append((statement, params))
        return self.results.pop(0) if self.results else result()

    async def scalar(self, statement: object) -> object:
        self.executed.append((statement, None))
        return self.scalar_value


def sql(statement: object) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))  # type: ignore[attr-defined]


def batch(size: int = 2) -> ObservationBatch:
    return ObservationBatch(
        aircraft_ids=[1] * size,
        flight_ids=[2] * size,
        observed_us=list(range(size)),
        longitudes=[2.5] * size,
        latitudes=[48.5] * size,
        altitudes=[3048.0] * size,
        speeds=[None] * size,
        headings=[90.0] * size,
        on_grounds=[False] * size,
    )


class TestMicroseconds:
    def test_a_moment_survives_the_round_trip_to_the_microsecond(self) -> None:
        moment = datetime(2022, 7, 1, 10, 0, 0, 123_456, tzinfo=UTC)

        assert from_microseconds(to_microseconds(moment)) == moment

    def test_the_epoch_is_zero(self) -> None:
        assert to_microseconds(datetime(1970, 1, 1, tzinfo=UTC)) == 0


class TestEnsureAircraft:
    async def test_nothing_to_create_asks_nothing(self) -> None:
        session = FakeSession()

        assert await HistoricalStore(session).ensure_aircraft([]) == {}  # type: ignore[arg-type]
        assert session.executed == []

    async def test_the_new_aircraft_are_inserted_with_a_public_identifier_then_read_back(
        self,
    ) -> None:
        session = FakeSession([result(), result([("000001", 11), ("000002", 12)])], scalar=7)

        aircraft = await HistoricalStore(session).ensure_aircraft(["000001", "000002"])  # type: ignore[arg-type]

        statement, rows = session.executed[1]
        assert 'ON CONFLICT ("CD_ICAO24", "ID_SOURCE_DONNEE") DO NOTHING' in sql(statement)
        assert [row["icao24"] for row in rows] == ["000001", "000002"]
        assert all(re.match(ULID_PATTERN, row["public_id"]) for row in rows)
        assert aircraft == {"000001": 11, "000002": 12}

    async def test_the_aircraft_take_the_source_of_the_replay(self) -> None:
        session = FakeSession([result(), result([("000001", 11)])], scalar=7)

        await HistoricalStore(session).ensure_aircraft(["000001"])  # type: ignore[arg-type]

        source_query, _ = session.executed[0]
        assert "R_SOURCE_DONNEE" in sql(source_query)
        assert "REJEU" in str(source_query.compile(compile_kwargs={"literal_binds": True}))  # type: ignore[attr-defined]
        _, rows = session.executed[1]
        assert [row["source_id"] for row in rows] == [7]

    async def test_the_known_aircraft_are_read_with_one_array_parameter_and_their_source(
        self,
    ) -> None:
        session = FakeSession([result(), result([("000001", 11)])], scalar=7)

        await HistoricalStore(session).ensure_aircraft(["000001"])  # type: ignore[arg-type]

        query = sql(session.executed[2][0])
        assert '"CD_ICAO24" = ANY (' in query
        assert '"ID_SOURCE_DONNEE" =' in query
        assert "SELECT *" not in query


class TestEnsureFlights:
    async def test_nothing_to_create_asks_nothing(self) -> None:
        session = FakeSession()

        assert await HistoricalStore(session).ensure_flights([]) == {}  # type: ignore[arg-type]
        assert session.executed == []

    async def test_a_known_flight_is_reused_and_the_others_are_created(self) -> None:
        session = FakeSession(
            [
                result([(9, 11, from_microseconds(1_000_000))]),
                result([(10, 11, from_microseconds(5_000_000))]),
            ]
        )
        flights = [NewFlight(11, 1_000_000, 2_000_000), NewFlight(11, 5_000_000, 6_000_000)]

        keys = await HistoricalStore(session).ensure_flights(flights)  # type: ignore[arg-type]

        assert keys == {(11, 1_000_000): 9, (11, 5_000_000): 10}
        _, rows = session.executed[1]
        assert len(rows) == 1  # only the missing flight is inserted
        assert rows[0]["aircraft_id"] == 11
        assert rows[0]["started_at"] == from_microseconds(5_000_000)
        assert rows[0]["ended_at"] == from_microseconds(6_000_000)
        assert re.match(ULID_PATTERN, rows[0]["public_id"])

    async def test_known_flights_insert_nothing(self) -> None:
        session = FakeSession([result([(9, 11, from_microseconds(1_000_000))])])

        keys = await HistoricalStore(session).ensure_flights([NewFlight(11, 1_000_000, 2_000_000)])  # type: ignore[arg-type]

        assert keys == {(11, 1_000_000): 9}
        assert len(session.executed) == 1

    async def test_the_existing_flights_are_read_without_the_deleted_ones(self) -> None:
        session = FakeSession([result()])

        await HistoricalStore(session).ensure_flights([NewFlight(11, 1, 2)])  # type: ignore[arg-type]

        assert "deleted_at IS NULL" in sql(session.executed[0][0])


class TestCounts:
    async def test_no_aircraft_means_no_observation_and_no_query(self) -> None:
        session = FakeSession()

        assert await HistoricalStore(session).count_observations([]) == 0  # type: ignore[arg-type]
        assert session.executed == []

    async def test_the_observations_of_the_aircraft_are_counted(self) -> None:
        session = FakeSession(scalar=42)

        count = await HistoricalStore(session).count_observations([1, 2])  # type: ignore[arg-type]

        assert count == 42
        assert '"ID_AERONEF" = ANY (' in sql(session.executed[0][0])

    async def test_a_missing_count_is_zero(self) -> None:
        assert await HistoricalStore(FakeSession(scalar=None)).count_observations([1]) == 0  # type: ignore[arg-type]


class TestInsertObservations:
    async def test_a_batch_is_one_statement_with_one_array_per_column(self) -> None:
        session = FakeSession([result(rowcount=2)])

        inserted = await HistoricalStore(session).insert_observations(batch())  # type: ignore[arg-type]

        statement, params = session.executed[0]
        assert statement is _INSERT_OBSERVATIONS
        assert inserted == 2
        assert set(params) == {
            "aircraft_ids", "flight_ids", "observed_us", "longitudes", "latitudes",
            "altitudes", "speeds", "headings", "on_grounds",
        }  # fmt: skip
        assert params["speeds"] == [None, None]

    async def test_the_values_are_bound_parameters_never_part_of_the_text(self) -> None:
        text = str(_INSERT_OBSERVATIONS)

        assert text.count(":") >= 9
        assert 'ON CONFLICT ("ID_AERONEF", "DT_DERNIER_CONTACT") DO NOTHING' in text
        assert "ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326)" in text
        assert "SELECT *" not in text

    async def test_a_missing_row_count_is_zero(self) -> None:
        session = FakeSession([SimpleNamespace(all=lambda: [], rowcount=None)])

        assert await HistoricalStore(session).insert_observations(batch()) == 0  # type: ignore[arg-type]


class Transaction:
    def __init__(self, log: list[str]) -> None:
        self._log = log

    async def __aenter__(self) -> "Transaction":
        self._log.append("begin")
        return self

    async def __aexit__(self, exc_type: object, *rest: object) -> None:
        self._log.append("rollback" if exc_type else "commit")


class TransactionalSession(FakeSession):
    """A session that logs how its transaction ends, like the one the unit of work opens."""

    def __init__(self) -> None:
        super().__init__()
        self.log: list[str] = []

    async def __aenter__(self) -> "TransactionalSession":
        self.log.append("open")
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        self.log.append("closed")

    def begin(self) -> Transaction:
        return Transaction(self.log)


class TestUnitOfWork:
    async def test_a_unit_gives_a_store_on_its_own_session_and_commits_at_the_end(self) -> None:
        sessions: list[TransactionalSession] = []

        def new_session() -> TransactionalSession:
            sessions.append(TransactionalSession())
            return sessions[-1]

        unit = HistoricalUnitOfWork(new_session)  # type: ignore[arg-type]

        async with unit() as store:
            assert isinstance(store, HistoricalStore)
            assert sessions[0].log == ["open", "begin"]
        async with unit():
            pass

        assert len(sessions) == 2  # one session for each unit, so one connection each
        assert sessions[0].log == ["open", "begin", "commit", "closed"]

    async def test_an_error_rolls_the_unit_back_and_is_raised_again(self) -> None:
        session = TransactionalSession()
        unit = HistoricalUnitOfWork(lambda: session)  # type: ignore[arg-type]

        with pytest.raises(RuntimeError, match="boom"):
            async with unit():
                raise RuntimeError("boom")

        assert session.log == ["open", "begin", "rollback", "closed"]
