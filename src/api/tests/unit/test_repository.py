from unittest.mock import AsyncMock

from sqlalchemy.dialects import postgresql

from core.repository import Repository
from models import Aircraft, Role


def sql(repository: Repository, **options: bool) -> str:
    return str(repository.select(**options).compile(dialect=postgresql.dialect()))


def test_reads_skip_deleted_rows_by_default() -> None:
    assert "deleted_at IS NULL" in sql(Repository(AsyncMock(), Aircraft))


def test_deleted_rows_are_read_only_on_request() -> None:
    assert "deleted_at IS NULL" not in sql(Repository(AsyncMock(), Aircraft), include_deleted=True)


def test_a_table_without_soft_delete_has_no_filter() -> None:
    assert "deleted_at" not in sql(Repository(AsyncMock(), Role))


async def test_get_runs_the_filtered_query() -> None:
    session = AsyncMock()
    session.scalar.return_value = "row"

    assert await Repository(session, Aircraft).get(1) == "row"
    assert "deleted_at IS NULL" in str(session.scalar.await_args.args[0])


async def test_soft_delete_sets_the_date_and_keeps_the_row() -> None:
    session = AsyncMock()
    aircraft = Aircraft(icao24="3c6444")

    await Repository(session, Aircraft).soft_delete(aircraft)

    assert aircraft.deleted_at is not None
    session.delete.assert_not_called()
    session.flush.assert_awaited_once()
