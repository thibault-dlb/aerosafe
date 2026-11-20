from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from core.data_mode import DataMode
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
    """Keeps runs in `EXECUTION_COLLECTE` and the pauses in `PARAMETRE_COLLECTE`, for each
    live source.

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
                    # A subquery inlined in the INSERT: the source table holds three rows.
                    source_id=run.source.source_id(),
                    states_received=run.received,
                    states_stored=run.stored,
                    states_rejected=run.rejected,
                    remaining_credits=run.remaining_credits,
                    error=run.error,
                    evaluation_error=run.evaluation_error,
                )
            )
            await session.commit()

    async def runs(
        self, limit: int, before: datetime | None = None, source: DataMode = DataMode.OPENSKY
    ) -> list[CollectionRunResult]:
        async with self._session_factory() as session:
            # Keyset paging on DT_DEBUT: the cycles of a source never overlap, so it is unique.
            statement = self._runs(session, source).limit(limit)
            if before is not None:
                statement = statement.where(CollectionRun.started_at < before)
            return [self._to_result(run, source) for run in await session.scalars(statement)]

    async def last_success(self, source: DataMode = DataMode.OPENSKY) -> CollectionRunResult | None:
        async with self._session_factory() as session:
            statement = (
                self._runs(session, source)
                .join(CollectionRun.status)
                .where(CollectionStatus.code.in_(RunStatus.COLLECTED))
                .limit(1)
            )
            run = await session.scalar(statement)
            return self._to_result(run, source) if run else None

    async def pause_state(self, source: DataMode = DataMode.OPENSKY) -> PauseState:
        async with self._session_factory() as session:
            parameter = await self._parameter(session, source)
            return PauseState(parameter.is_paused, parameter.changed_at, parameter.changed_by_id)

    async def set_paused(
        self,
        paused: bool,
        at: datetime,
        user_id: int | None,
        source: DataMode = DataMode.OPENSKY,
    ) -> PauseState:
        async with self._session_factory() as session:
            parameter = await self._parameter(session, source)
            parameter.is_paused = paused
            parameter.changed_at = at
            parameter.changed_by_id = user_id
            await session.commit()
            return PauseState(paused, at, user_id)

    @staticmethod
    def _runs(session: AsyncSession, source: DataMode) -> Select[tuple[CollectionRun]]:
        # The index (ID_SOURCE_DONNEE, DT_DEBUT) serves the filter and the order.
        return (
            Repository(session, CollectionRun)
            .select()
            .options(joinedload(CollectionRun.status), joinedload(CollectionRun.profile))
            .where(source.matches(CollectionRun.source_id))
            .order_by(CollectionRun.started_at.desc(), CollectionRun.id.desc())
        )

    @staticmethod
    async def _parameter(session: AsyncSession, source: DataMode) -> CollectionParameter:
        # The migrations insert one row per live source; there is never a second one.
        statement = select(CollectionParameter).where(source.matches(CollectionParameter.source_id))
        return (await session.scalars(statement)).one()

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
    def _to_result(run: CollectionRun, source: DataMode) -> CollectionRunResult:
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
            source=source,
        )


state_store: CollectionStateStore = DatabaseCollectionStateStore()


def get_state_store() -> CollectionStateStore:
    """FastAPI dependency, overridden in tests."""
    return state_store
