from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from core.database import database
from core.logger import get_logger
from services.collection.collector import DataCollector, utc_now
from services.collection.opensky_client import OpenSkyRateLimited, OpenSkyUnavailable
from services.collection.run_state import CollectionRunResult, CollectionStateStore, RunStatus
from services.rules.engine import RulesEngine

logger = get_logger()

SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]
EngineFactory = Callable[[AsyncSession], RulesEngine]


@asynccontextmanager
async def database_session() -> AsyncIterator[AsyncSession]:
    async for session in database.get_session():
        yield session


class CollectionCycle:
    """One scheduled cycle: collection, then evaluation of the rules (D-05).

    Never raises: OpenSky or database failures become a status, so the API stays up (NF-04).
    A failure of the rules engine is recorded but never cancels the collection.
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

    async def run(self) -> CollectionRunResult:
        started_at = self._clock()
        result = await self._collect(started_at)
        if result.status in RunStatus.COLLECTED:
            result = result.with_evaluation_error(await self._evaluate(started_at))
        await self._record(result)
        return result

    async def _collect(self, started_at: datetime) -> CollectionRunResult:
        skip_reason = await self._skip_reason(started_at)
        if skip_reason:
            return self._result(started_at, RunStatus.SKIPPED, skip_reason)
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

    async def _skip_reason(self, now: datetime) -> str | None:
        try:
            if (await self._state_store.pause_state()).paused:
                return "Collection paused by a Supervisor"
        except Exception:
            logger.exception("Cannot read the collection pause")
        if self._rate_limited_until and now < self._rate_limited_until:
            return f"Waiting for OpenSky credits until {self._rate_limited_until.isoformat()}"
        return None

    async def _evaluate(self, collected_at: datetime) -> str | None:
        try:
            async with self._session_factory() as session:
                await self._engine_factory(session).evaluate(collected_at)
                await session.commit()
        except NotImplementedError:
            logger.info("Rules engine not implemented yet, evaluation skipped")
            return "Rules engine not implemented"
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
