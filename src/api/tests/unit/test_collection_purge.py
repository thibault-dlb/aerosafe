from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy.dialects import postgresql

from core.data_mode import DataMode
from services.collection.purge import ObservationPurger, PurgeReport

NOW = datetime(2026, 11, 20, 12, tzinfo=UTC)
WEEK = timedelta(days=7)


def literal_sql(statement) -> str:
    return str(
        statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )


class Sessions:
    """Answers each statement with the next row count, and counts the commits."""

    def __init__(self, *rowcounts: int | None) -> None:
        self.rowcounts = list(rowcounts)
        self.statements: list = []
        self.commits = 0

    @asynccontextmanager
    async def __call__(self):
        yield self

    async def execute(self, statement) -> SimpleNamespace:
        self.statements.append(statement)
        return SimpleNamespace(rowcount=self.rowcounts.pop(0))

    async def commit(self) -> None:
        self.commits += 1


def purger(sessions: Sessions, batch_size: int = 3) -> ObservationPurger:
    return ObservationPurger(
        WEEK, batch_size=batch_size, session_factory=sessions, clock=lambda: NOW
    )


def test_a_batch_reads_the_old_points_of_each_adsbfi_aircraft() -> None:
    sql = literal_sql(purger(Sessions()).delete_statement(NOW - WEEK))

    assert sql.startswith('DELETE FROM "OBSERVATION"')
    # Aircraft by aircraft, never a scan of the contact times: the replay is older than a week.
    assert "JOIN LATERAL" in sql
    assert '"OBSERVATION"."ID_AERONEF" = "AERONEF"."ID"' in sql
    assert "'ADSBFI'" in sql
    assert "'2026-11-13 12:00:00+00:00'" in sql
    assert "LIMIT 3" in sql


def test_the_flights_ended_before_the_cutoff_are_soft_deleted() -> None:
    sql = literal_sql(purger(Sessions()).flights_statement(NOW - WEEK, NOW))

    assert sql.startswith('UPDATE "VOL" SET deleted_at=')
    assert '"VOL"."DT_FIN" < \'2026-11-13 12:00:00+00:00\'' in sql
    assert "'ADSBFI'" in sql


async def test_the_batches_go_on_until_one_is_not_full() -> None:
    sessions = Sessions(3, 3, 1, 2)

    report = await purger(sessions).run()

    assert report == PurgeReport(observations=7, flights=2)
    assert len(sessions.statements) == 4
    assert sessions.commits == 4


async def test_nothing_to_purge_takes_one_batch() -> None:
    sessions = Sessions(0, None)

    assert await purger(sessions).run() == PurgeReport()


@pytest.mark.parametrize(
    ("retention", "mode"),
    [(timedelta(0), DataMode.ADSBFI), (WEEK, DataMode.REPLAY)],
)
def test_the_replay_and_an_empty_retention_are_refused(
    retention: timedelta, mode: DataMode
) -> None:
    with pytest.raises(ValueError):
        ObservationPurger(retention, mode)
