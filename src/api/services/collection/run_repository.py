from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from core.repository import Repository
from models import CollectionParameter, CollectionRun, CollectionStatus
from models import CollectionProfile as CollectionProfileRef
from services.collection.run_state import (
    CollectionRunResult,
    CollectionStateStore,
    PauseState,
    RunStatus,
)
from services.collection.sessions import SessionFactory, database_session


class DatabaseCollectionStateStore:
    """Keeps runs in `EXECUTION_COLLECTE` and the pause in `PARAMETRE_COLLECTE`.

    A run is inserted once, complete: its `DT_FIN` is set after the evaluation, and the row
    is never changed afterwards.
    """

    def __init__(self, session_factory: SessionFactory = database_session) -> None:
        self._session_factory = session_factory
        self._reference_ids: dict[tuple[type, str], int] = {}

    async def record(self, run: CollectionRunResult) -> None:
        async with self._session_factory() as session:
            session.add(
                CollectionRun(
                    started_at=run.started_at,
                    ended_at=run.ended_at,
                    status_id=await self._id_of(session, CollectionStatus, run.status),
                    profile_id=await self._id_of(session, CollectionProfileRef, run.profile),
                    states_received=run.received,
                    states_stored=run.stored,
                    states_rejected=run.rejected,
                    remaining_credits=run.remaining_credits,
                    error=run.error,
                    evaluation_error=run.evaluation_error,
                )
            )
            await session.commit()

    async def runs(self, limit: int, before: datetime | None = None) -> list[CollectionRunResult]:
        async with self._session_factory() as session:
            # Keyset paging on DT_DEBUT: the cycles never overlap, so it is unique.
            statement = self._runs(session).limit(limit)
            if before is not None:
                statement = statement.where(CollectionRun.started_at < before)
            return [self._to_result(run) for run in await session.scalars(statement)]

    async def last_success(self) -> CollectionRunResult | None:
        async with self._session_factory() as session:
            statement = (
                self._runs(session)
                .join(CollectionRun.status)
                .where(CollectionStatus.code.in_(RunStatus.COLLECTED))
                .limit(1)
            )
            run = await session.scalar(statement)
            return self._to_result(run) if run else None

    async def pause_state(self) -> PauseState:
        async with self._session_factory() as session:
            parameter = await self._parameter(session)
            return PauseState(parameter.is_paused, parameter.changed_at, parameter.changed_by_id)

    async def set_paused(self, paused: bool, at: datetime, user_id: int | None) -> PauseState:
        async with self._session_factory() as session:
            parameter = await self._parameter(session)
            parameter.is_paused = paused
            parameter.changed_at = at
            parameter.changed_by_id = user_id
            await session.commit()
            return PauseState(paused, at, user_id)

    @staticmethod
    def _runs(session: AsyncSession) -> Select[tuple[CollectionRun]]:
        return (
            Repository(session, CollectionRun)
            .select()
            .options(joinedload(CollectionRun.status), joinedload(CollectionRun.profile))
            .order_by(CollectionRun.started_at.desc(), CollectionRun.id.desc())
        )

    @staticmethod
    async def _parameter(session: AsyncSession) -> CollectionParameter:
        # The migrations insert the single row; there is never a second one.
        return (await session.scalars(select(CollectionParameter))).one()

    async def _id_of(
        self,
        session: AsyncSession,
        model: type[CollectionStatus] | type[CollectionProfileRef],
        code: str,
    ) -> int:
        """Key of an active reference row; an inactive or unknown code raises."""
        key = (model, code)
        if key not in self._reference_ids:
            statement = select(model.id).where(model.code == code, model.is_active.is_(True))
            self._reference_ids[key] = (await session.execute(statement)).scalar_one()
        return self._reference_ids[key]

    @staticmethod
    def _to_result(run: CollectionRun) -> CollectionRunResult:
        return CollectionRunResult(
            started_at=run.started_at,
            ended_at=run.ended_at or run.started_at,
            status=run.status.code,
            profile=run.profile.code,
            received=run.states_received,
            stored=run.states_stored,
            rejected=run.states_rejected,
            remaining_credits=run.remaining_credits,
            error=run.error,
            evaluation_error=run.evaluation_error,
        )


state_store: CollectionStateStore = DatabaseCollectionStateStore()


def get_state_store() -> CollectionStateStore:
    """FastAPI dependency, overridden in tests."""
    return state_store
