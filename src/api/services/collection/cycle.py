from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import get_logger
from services.collection.collector import DataCollector, utc_now
from services.collection.opensky_client import OpenSkyRateLimited, OpenSkyUnavailable
from services.collection.run_state import CollectionRunResult, CollectionStateStore, RunStatus
from services.collection.sessions import SessionFactory, database_session
from services.rules.engine import RulesEngine

logger = get_logger()

EngineFactory = Callable[[AsyncSession], RulesEngine]


class CollectionCycle:
    """One scheduled cycle: collection, then evaluation of the rules (D-05).

    Never raises: OpenSky or database failures become a status, so the API stays up (NF-04).
    A failure of the rules engine is recorded but never cancels the collection. A scheduled
    cycle is skipped while a Supervisor pauses the collection; a manual one is not.
    """

    def __init__(
        self,
        collector: DataCollector,
        state_store: CollectionStateStore,
        session_factory: SessionFactory = database_session,
        engine_factory: EngineFactory = RulesEngine,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._collector = collector
        self._state_store = state_store
        self._session_factory = session_factory
        self._engine_factory = engine_factory
        self._clock = clock
        self._rate_limited_until: datetime | None = None

    @property
    def rate_limited_until(self) -> datetime | None:
        return self._rate_limited_until

    def waiting_for_credits(self) -> bool:
        """Whether OpenSky answered 429 and the announced delay is not over."""
        return self._waiting_for_credits(self._clock())

    async def run(self, manual: bool = False) -> CollectionRunResult:
        started_at = self._clock()
        result = await self._collect(started_at, manual)
        if result.status in RunStatus.COLLECTED:
            result = result.with_evaluation_error(await self._evaluate(started_at))
        # The end is set last, after the evaluation: the recorded row is final.
        result = replace(result, ended_at=self._clock())
        await self._record(result)
        return result

    async def _collect(self, started_at: datetime, manual: bool) -> CollectionRunResult:
        if not manual and await self._paused():
            return self._result(started_at, RunStatus.SKIPPED, "Collection paused by a Supervisor")
        if self._waiting_for_credits(started_at):
            # Still within the delay of a 429: no request, and the status says why.
            until = self._rate_limited_until.isoformat() if self._rate_limited_until else ""
            return self._result(
                started_at, RunStatus.RATE_LIMITED, f"Waiting for OpenSky credits until {until}"
            )
        try:
            async with self._session_factory() as session:
                result = await self._collector.run(session, started_at)
        except OpenSkyRateLimited as error:
            wait = timedelta(seconds=error.retry_after_seconds or self._period_seconds)
            self._rate_limited_until = started_at + wait
            logger.warning("OpenSky credits used up until {}", self._rate_limited_until)
            return self._result(started_at, RunStatus.RATE_LIMITED, str(error))
        except OpenSkyUnavailable as error:
            logger.warning("OpenSky unavailable: {}", error)
            return self._result(started_at, RunStatus.FAILED, str(error))
        except Exception as error:  # The database, or a bug: logged, never raised.
            logger.exception("Collection failed")
            return self._result(started_at, RunStatus.FAILED, repr(error))
        logger.info(
            "Collection {}: {} received, {} stored, {} rejected",
            result.status,
            result.received,
            result.stored,
            result.rejected,
        )
        return result

    async def _paused(self) -> bool:
        try:
            return (await self._state_store.pause_state()).paused
        except Exception:
            logger.exception("Cannot read the collection pause")
            return False

    def _waiting_for_credits(self, now: datetime) -> bool:
        return self._rate_limited_until is not None and now < self._rate_limited_until

    async def _evaluate(self, collected_at: datetime) -> str | None:
        try:
            async with self._session_factory() as session:
                await self._engine_factory(session).evaluate(collected_at)
                await session.commit()
        except Exception as error:
            logger.exception("Rule evaluation failed")
            return repr(error)
        return None

    async def _record(self, result: CollectionRunResult) -> None:
        try:
            await self._state_store.record(result)
        except Exception:
            logger.exception("Cannot record the collection run")

    @property
    def _period_seconds(self) -> int:
        return self._collector.profile.period_seconds

    def _result(self, started_at: datetime, status: str, error: str) -> CollectionRunResult:
        return CollectionRunResult(
            started_at=started_at,
            ended_at=self._clock(),
            status=status,
            profile=self._collector.profile.code,
            error=error,
        )
