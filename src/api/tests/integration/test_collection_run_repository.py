"""DatabaseCollectionStateStore against the migrated database."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import CollectionRun
from services.collection.run_repository import DatabaseCollectionStateStore
from services.collection.run_state import CollectionRunResult, RunStatus

pytestmark = pytest.mark.integration

# Far in the future, so these runs come first whatever the database already holds.
T0 = datetime(2099, 1, 1, 12, tzinfo=UTC)


def store_on(session: AsyncSession) -> DatabaseCollectionStateStore:
    @asynccontextmanager
    async def same_session() -> AsyncIterator[AsyncSession]:
        yield session

    return DatabaseCollectionStateStore(same_session)


def run(offset: int, status: str = RunStatus.SUCCESS, **values: object) -> CollectionRunResult:
    started_at = T0 + timedelta(minutes=offset)
    return CollectionRunResult(
        started_at=started_at,
        ended_at=started_at + timedelta(seconds=2),
        status=status,
        profile="ILE_DE_FRANCE",
        **values,  # type: ignore[arg-type]
    )


async def test_a_run_is_stored_complete_and_read_back(session: AsyncSession) -> None:
    store = store_on(session)
    recorded = run(
        0,
        RunStatus.PARTIAL,
        received=60,
        stored=55,
        rejected=1,
        remaining_credits=280,
        evaluation_error="Rules engine not implemented",
    )

    await store.record(recorded)

    assert (await store.runs(1)) == [recorded]
    row = await session.scalar(select(CollectionRun).where(CollectionRun.started_at == T0))
    assert row is not None and row.ended_at == T0 + timedelta(seconds=2)


async def test_runs_come_newest_first_with_paging(session: AsyncSession) -> None:
    store = store_on(session)
    for offset in range(3):
        await store.record(run(offset, stored=offset))

    assert [r.stored for r in await store.runs(2)] == [2, 1]
    assert [r.stored for r in await store.runs(1, offset=2)] == [0]


async def test_the_last_success_skips_failed_and_skipped_runs(session: AsyncSession) -> None:
    store = store_on(session)
    await store.record(run(0, stored=9))
    await store.record(run(1, RunStatus.FAILED, error="down"))
    await store.record(run(2, RunStatus.SKIPPED, error="paused"))

    last = await store.last_success()

    assert last is not None and last.stored == 9


async def test_the_pause_is_kept_in_the_parameter_row(session: AsyncSession) -> None:
    store = store_on(session)

    paused = await store.set_paused(True, T0, user_id=None)

    assert paused.paused
    assert await store.pause_state() == paused
    await store.set_paused(False, T0 + timedelta(minutes=1), user_id=None)
    assert (await store.pause_state()).paused is False
