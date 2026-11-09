import asyncio
from datetime import UTC, datetime, timedelta
from typing import ClassVar

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config.opensky import OpenSkySettings
from config.opensky import settings as opensky_settings
from core.logger import get_logger
from services.collection.collector import DataCollector
from services.collection.cycle import CollectionCycle
from services.collection.flight_grouper import FlightGrouper
from services.collection.opensky_client import OpenSkyClient, TokenProvider
from services.collection.run_repository import state_store
from services.collection.run_state import CollectionRunResult

logger = get_logger()

_JOB_ID = "collection"


class CollectionBusy(Exception):
    """A collection cycle is already running."""


class CollectionDisabled(Exception):
    """This instance does not collect (`COLLECTION_ENABLED` is false)."""


class CollectionRateLimited(Exception):
    """OpenSky answered 429 and the delay it announced is not over."""

    def __init__(self, until: datetime | None) -> None:
        super().__init__(f"OpenSky credits are used up until {until}")
        self.until = until


class Scheduler:
    """Runs the collection, then the rules engine, inside the API process.

    The application starts and stops it, so `main.py` does not change when it is implemented.
    Frozen signature: `Scheduler()`, `start()`, `stop()`.
    """

    _current: ClassVar["Scheduler | None"] = None

    def __init__(
        self,
        settings: OpenSkySettings | None = None,
        cycle: CollectionCycle | None = None,
    ) -> None:
        self._settings = settings or opensky_settings
        self._cycle = cycle
        self._http: httpx.AsyncClient | None = None
        self._jobs: AsyncIOScheduler | None = None
        self._lock = asyncio.Lock()

    @classmethod
    def current(cls) -> "Scheduler | None":
        """The scheduler started by the application, for the collection endpoints."""
        return cls._current

    @property
    def settings(self) -> OpenSkySettings:
        return self._settings

    @property
    def enabled(self) -> bool:
        return self._settings.COLLECTION_ENABLED

    @property
    def busy(self) -> bool:
        return self._lock.locked()

    @property
    def rate_limited_until(self) -> datetime | None:
        return self._cycle.rate_limited_until if self._cycle else None

    async def start(self) -> None:
        """Start the periodic cycles, the first one right away. Does nothing when disabled."""
        Scheduler._current = self
        if not self.enabled:
            logger.info("OpenSky collection disabled on this instance")
            return
        if self._cycle is None:
            self._cycle = self._build_cycle()

        profile = self._settings.profile
        hours = self._settings.hours_until_quota
        if hours is not None:
            logger.warning("Anonymous OpenSky access: credits run out after {:.1f} h", hours)

        self._jobs = AsyncIOScheduler(timezone=UTC)
        self._jobs.add_job(
            self._tick,
            "interval",
            seconds=profile.period_seconds,
            id=_JOB_ID,
            next_run_time=datetime.now(UTC) + timedelta(seconds=1),
            max_instances=1,
            coalesce=True,
            misfire_grace_time=profile.period_seconds,
        )
        self._jobs.start()
        logger.info(
            "OpenSky collection started: {} every {} s", profile.code, profile.period_seconds
        )

    async def stop(self) -> None:
        """Stop the periodic cycles, let a running one finish, then close the OpenSky connection."""
        if self._jobs is not None:
            self._jobs.shutdown(wait=False)
            self._jobs = None
        # A cycle still running uses the HTTP client and the database: wait for its end.
        async with self._lock:
            if self._http is not None:
                await self._http.aclose()
                self._http = None
                # The cycle was built on the closed client: the next start builds a new one.
                self._cycle = None
        if Scheduler._current is self:
            Scheduler._current = None

    async def run_now(self) -> CollectionRunResult:
        """Run one cycle immediately, for the Supervisor (it uses credits), even when paused."""
        if not self.enabled or self._cycle is None:
            raise CollectionDisabled
        if self.busy:
            raise CollectionBusy
        if self._cycle.waiting_for_credits():
            raise CollectionRateLimited(self._cycle.rate_limited_until)
        async with self._lock:
            return await self._cycle.run(manual=True)

    async def _tick(self) -> None:
        if self.busy or self._cycle is None:
            return
        async with self._lock:
            await self._cycle.run()

    def _build_cycle(self) -> CollectionCycle:
        settings = self._settings
        self._http = httpx.AsyncClient(timeout=settings.OPENSKY_TIMEOUT_SECONDS)
        token_provider = None
        if settings.has_credentials:
            token_provider = TokenProvider(
                self._http,
                settings.OPENSKY_TOKEN_URL,
                settings.OPENSKY_CLIENT_ID,
                settings.OPENSKY_CLIENT_SECRET.get_secret_value(),
            )
        client = OpenSkyClient(self._http, settings.OPENSKY_API_URL, token_provider)
        grouper = FlightGrouper(timedelta(minutes=settings.COLLECTION_FLIGHT_GAP_MINUTES))
        return CollectionCycle(DataCollector(client, settings.profile, grouper), state_store)
