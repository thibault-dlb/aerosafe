from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from core.logger import get_logger
from services.collection.sessions import SessionFactory, database_session
from services.replay.clock import ReplayClock
from services.replay.service import EVALUATION_STEP, ReplayService
from services.replay.store import DatabaseReplayStore, ReplayStore, state_store
from services.rules.engine import RulesEngine

logger = get_logger()

_JOB_ID = "replay"

# The clock is read every few seconds of real time, and the rules are evaluated for every step
# of simulated time that went by since the last tick: at the speed 60, ten seconds make 20 steps.
TICK_SECONDS = 10
# A tick evaluates at most this many steps, so a slow database never makes it run for ever. The
# next tick goes on from there, and the replay is then late on its clock.
MAX_STEPS_PER_TICK = 120


async def evaluate_in_transaction(session: AsyncSession, step: datetime) -> None:
    """Evaluate the rules at `step` and note it, in the same transaction."""
    await RulesEngine(session).evaluate(step, DataMode.REPLAY)
    await DatabaseReplayStore.record_evaluation(session, step)
    await session.commit()


class ReplayEvaluator:
    """Runs the rules engine for each step of simulated time that went by."""

    def __init__(
        self,
        store: ReplayStore,
        session_factory: SessionFactory = database_session,
        service: ReplayService | None = None,
        evaluate: Callable[[AsyncSession, datetime], Awaitable[None]] = evaluate_in_transaction,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._store = store
        self._session_factory = session_factory
        self._service = service or ReplayService(store)
        self._evaluate = evaluate
        self._now = now

    async def tick(self) -> int:
        """Evaluate the steps that are due and return how many were evaluated."""
        state = await self._store.state()
        if not state.started or state.evaluated_until is None:
            return 0
        target = ReplayClock(state, await self._service.bounds()).now(self._now())
        if target is None:
            return 0

        done = 0
        step = state.evaluated_until + EVALUATION_STEP
        while step <= target and done < MAX_STEPS_PER_TICK:
            async with self._session_factory() as session:
                await self._evaluate(session, step)
            step += EVALUATION_STEP
            done += 1
        if step <= target:
            late = (target - step).total_seconds()
            logger.warning("The replay is {:.0f} s of simulated time late on its clock", late)
        return done


class ReplayScheduler:
    """Runs the evaluator in the API process, next to the collection scheduler."""

    _current: ClassVar["ReplayScheduler | None"] = None

    def __init__(self, evaluator: ReplayEvaluator | None = None) -> None:
        self._evaluator = evaluator or ReplayEvaluator(state_store)
        self._jobs: AsyncIOScheduler | None = None

    @classmethod
    def current(cls) -> "ReplayScheduler | None":
        return cls._current

    async def start(self) -> None:
        ReplayScheduler._current = self
        self._jobs = AsyncIOScheduler(timezone=UTC)
        self._jobs.add_job(
            self._tick,
            "interval",
            seconds=TICK_SECONDS,
            id=_JOB_ID,
            next_run_time=datetime.now(UTC) + timedelta(seconds=TICK_SECONDS),
            max_instances=1,
            coalesce=True,
            misfire_grace_time=TICK_SECONDS,
        )
        self._jobs.start()
        logger.info("Replay clock watched every {} s", TICK_SECONDS)

    async def stop(self) -> None:
        if self._jobs is not None:
            self._jobs.shutdown(wait=False)
            self._jobs = None
        if ReplayScheduler._current is self:
            ReplayScheduler._current = None

    async def _tick(self) -> None:
        try:
            await self._evaluator.tick()
        except Exception:  # noqa: BLE001 - a failed tick must not stop the next ones
            logger.exception("The replay tick failed")
