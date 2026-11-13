from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from models import Aircraft, Alert, Flight, ReplayParameter
from services.collection.sessions import SessionFactory, database_session
from services.replay.clock import ReplayBounds, ReplayState


class ReplayStore(Protocol):
    """What the replay needs from the database; `DatabaseReplayStore` is the real one."""

    async def state(self) -> ReplayState: ...

    async def save(self, state: ReplayState) -> None: ...

    async def bounds(self) -> ReplayBounds | None: ...

    async def reset_alerts(self, at: datetime) -> None: ...


class DatabaseReplayStore:
    """Keeps the clock in `PARAMETRE_REJEU` and reads the period of the replayed data."""

    def __init__(self, session_factory: SessionFactory = database_session) -> None:
        self._session_factory = session_factory

    async def state(self) -> ReplayState:
        async with self._session_factory() as session:
            parameter = await self._parameter(session)
            return ReplayState(
                simulated_at=parameter.simulated_at,
                changed_at=parameter.changed_at,
                speed=parameter.speed,
                paused=parameter.is_paused,
                evaluated_until=parameter.evaluated_until,
                changed_by_id=parameter.changed_by_id,
            )

    async def save(self, state: ReplayState) -> None:
        async with self._session_factory() as session:
            parameter = await self._parameter(session)
            parameter.simulated_at = state.simulated_at
            parameter.changed_at = state.changed_at
            parameter.speed = state.speed
            parameter.is_paused = state.paused
            parameter.evaluated_until = state.evaluated_until
            parameter.changed_by_id = state.changed_by_id
            await session.commit()

    async def bounds(self) -> ReplayBounds | None:
        """First and last instant of the replayed flights, or None when nothing was imported.

        It reads `VOL`, a table of a few hundred thousand rows, and not `OBSERVATION`, which
        holds hundreds of millions.
        """
        statement = (
            select(
                func.min(Flight.started_at),
                func.max(func.coalesce(Flight.ended_at, Flight.started_at)),
            )
            .join(Aircraft, Aircraft.id == Flight.aircraft_id)
            .where(DataMode.REPLAY.matches(Aircraft.source_id), Flight.deleted_at.is_(None))
        )
        async with self._session_factory() as session:
            start, end = (await session.execute(statement)).one()
        return None if start is None or end is None else ReplayBounds(start, end)

    async def reset_alerts(self, at: datetime) -> None:
        """Make the alerts of the replay consistent with a restart at `at`.

        The alerts dated `at` or later come from an earlier run: they would be created again as
        the clock goes by, so they are removed (logically). The episodes still open end at `at`.
        """
        replayed = select(Aircraft.id).where(DataMode.REPLAY.matches(Aircraft.source_id))
        removed = (
            update(Alert)
            .where(
                Alert.aircraft_id.in_(replayed),
                Alert.triggered_at >= at,
                Alert.deleted_at.is_(None),
            )
            .values(
                deleted_at=func.now(),
                episode_ended_at=func.coalesce(Alert.episode_ended_at, Alert.triggered_at),
            )
            .execution_options(synchronize_session=False)
        )
        ended = (
            update(Alert)
            .where(
                Alert.aircraft_id.in_(replayed),
                Alert.episode_ended_at.is_(None),
                Alert.deleted_at.is_(None),
            )
            .values(episode_ended_at=at)
            .execution_options(synchronize_session=False)
        )
        async with self._session_factory() as session:
            await session.execute(removed)
            await session.execute(ended)
            await session.commit()

    @staticmethod
    async def record_evaluation(session: AsyncSession, until: datetime) -> None:
        """Note, in the caller's transaction, that the rules were evaluated up to `until`."""
        parameter = await DatabaseReplayStore._parameter(session)
        parameter.evaluated_until = until

    @staticmethod
    async def _parameter(session: AsyncSession) -> ReplayParameter:
        # The migrations insert the single row; there is never a second one.
        return (await session.scalars(select(ReplayParameter))).one()


state_store: ReplayStore = DatabaseReplayStore()


def get_replay_store() -> ReplayStore:
    """FastAPI dependency, overridden in tests."""
    return state_store
