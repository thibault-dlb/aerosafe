"""Checks the collection tables against the migrated database."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models import CollectionParameter, CollectionProfile, CollectionRun, CollectionStatus

pytestmark = pytest.mark.integration


async def _id_of(session: AsyncSession, model: type, code: str) -> int:
    return (await session.execute(select(model.id).where(model.code == code))).scalar_one()


async def _new_run(session: AsyncSession, **values: object) -> CollectionRun:
    run = CollectionRun(
        started_at=datetime.now(UTC),
        status_id=await _id_of(session, CollectionStatus, "SUCCESS"),
        profile_id=await _id_of(session, CollectionProfile, "ILE_DE_FRANCE"),
        **values,
    )
    session.add(run)
    await session.flush()
    return run


async def test_collection_statuses_are_inserted(session: AsyncSession) -> None:
    codes = (await session.execute(select(CollectionStatus.code))).scalars().all()

    assert set(codes) == {"SUCCESS", "PARTIAL", "FAILED", "RATE_LIMITED", "SKIPPED"}


async def test_collection_profiles_are_inserted(session: AsyncSession) -> None:
    codes = (await session.execute(select(CollectionProfile.code))).scalars().all()

    assert set(codes) == {"ILE_DE_FRANCE", "FRANCE"}


async def test_collection_parameter_starts_with_one_row_not_paused(
    session: AsyncSession,
) -> None:
    [parameter] = (await session.execute(select(CollectionParameter))).scalars().all()

    assert parameter.is_paused is False
    assert parameter.changed_at is None
    assert parameter.changed_by_id is None


async def test_collection_parameter_rejects_a_second_row(session: AsyncSession) -> None:
    session.add(CollectionParameter(is_paused=True))

    with pytest.raises(IntegrityError, match="uq_parametre_collecte_ligne_unique"):
        await session.flush()


async def test_application_user_can_pause_the_collection(session: AsyncSession) -> None:
    parameter = (await session.execute(select(CollectionParameter))).scalar_one()
    parameter.is_paused = True
    parameter.changed_at = datetime.now(UTC)
    await session.flush()

    paused = await session.scalar(
        select(func.count()).select_from(CollectionParameter).where(CollectionParameter.is_paused)
    )
    assert paused == 1


async def test_collection_run_counts_default_to_zero(session: AsyncSession) -> None:
    run = await _new_run(session)
    await session.refresh(run)

    assert (run.states_received, run.states_stored, run.states_rejected) == (0, 0, 0)
    assert run.ended_at is None
    assert run.created_at is not None


async def test_collection_run_rejects_an_end_before_its_start(session: AsyncSession) -> None:
    with pytest.raises(IntegrityError, match="ck_execution_collecte_dates_ordered"):
        await _new_run(session, ended_at=datetime.now(UTC) - timedelta(seconds=1))


async def test_collection_run_rejects_a_negative_count(session: AsyncSession) -> None:
    with pytest.raises(IntegrityError, match="ck_execution_collecte_counts_not_negative"):
        await _new_run(session, states_rejected=-1)
