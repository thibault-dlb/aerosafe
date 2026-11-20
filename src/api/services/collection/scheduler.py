import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import ClassVar

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config.adsbfi import AdsbFiSettings
from config.adsbfi import settings as adsbfi_default_settings
from config.opensky import OpenSkySettings
from config.opensky import settings as opensky_settings
from core.data_mode import DataMode
from core.logger import get_logger
from services.collection.adsbfi_client import AdsbFiClient
from services.collection.collector import DataCollector
from services.collection.cycle import CollectionCycle
from services.collection.flight_grouper import FlightGrouper
from services.collection.opensky_client import OpenSkyClient, TokenProvider
from services.collection.profiles import CollectionProfile
from services.collection.purge import ObservationPurger
from services.collection.run_repository import state_store
from services.collection.run_state import CollectionRunResult
from services.collection.sources import AdsbFiSource, LiveSource, OpenSkySource

logger = get_logger()

_JOB_PREFIX = "collection-"
PURGE_JOB_ID = "purge-adsbfi"
# The purge runs every hour, the first one a minute after the start.
_PURGE_PERIOD = timedelta(hours=1)
_PURGE_DELAY = timedelta(minutes=1)


class CollectionBusy(Exception):
    """A collection cycle of the source is already running."""


class CollectionDisabled(Exception):
    """This instance does not collect the source (its `COLLECTION_*_ENABLED` is false)."""


class CollectionRateLimited(Exception):
    """The source refused requests (a 429) and the delay it announced is not over."""

    def __init__(self, until: datetime | None, source: DataMode = DataMode.OPENSKY) -> None:
        if source is DataMode.OPENSKY:
            message = f"OpenSky credits are used up until {until}"
        else:
            message = f"{source.label} refuses requests until {until}"
        super().__init__(message)
        self.until = until
        self.source = source


@dataclass
class _Collection:
    """What the scheduler holds for one live source: its cycle, the HTTP client it built for
    it (None for a cycle given from outside), and the lock that keeps one cycle at a time."""

    cycle: CollectionCycle | None = None
    http: httpx.AsyncClient | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class Scheduler:
    """Runs the collection of each live source, then its rules engine, inside the API process.

    OpenSky and adsb.fi are collected in parallel, each at its own period and with its own
    lock, pause and wait after a 429. Each one is switched on by its own setting.

    The application starts and stops it, so `main.py` does not change when it is implemented.
    Frozen signature: `Scheduler()`, `start()`, `stop()`.
    """

    _current: ClassVar["Scheduler | None"] = None

    def __init__(
        self,
        settings: OpenSkySettings | None = None,
        cycle: CollectionCycle | None = None,
        adsbfi_settings: AdsbFiSettings | None = None,
        adsbfi_cycle: CollectionCycle | None = None,
        purger: ObservationPurger | None = None,
    ) -> None:
        self._settings = settings or opensky_settings
        self._adsbfi_settings = adsbfi_settings or adsbfi_default_settings
        self._collections = {
            DataMode.OPENSKY: _Collection(cycle),
            DataMode.ADSBFI: _Collection(adsbfi_cycle),
        }
        self._purger = purger
        self._jobs: AsyncIOScheduler | None = None

    @classmethod
    def current(cls) -> "Scheduler | None":
        """The scheduler started by the application, for the collection endpoints."""
        return cls._current

    @property
    def settings(self) -> OpenSkySettings:
        return self._settings

    @property
    def adsbfi_settings(self) -> AdsbFiSettings:
        return self._adsbfi_settings

    def is_enabled(self, source: DataMode = DataMode.OPENSKY) -> bool:
        if source is DataMode.OPENSKY:
            return self._settings.COLLECTION_OPENSKY_ENABLED
        if source is DataMode.ADSBFI:
            return self._adsbfi_settings.COLLECTION_ADSBFI_ENABLED
        return False

    def profile(self, source: DataMode = DataMode.OPENSKY) -> CollectionProfile:
        if source is DataMode.ADSBFI:
            return self._adsbfi_settings.profile
        return self._settings.profile

    def is_busy(self, source: DataMode = DataMode.OPENSKY) -> bool:
        collection = self._collections.get(source)
        return collection is not None and collection.lock.locked()

    def rate_limited_until(self, source: DataMode = DataMode.OPENSKY) -> datetime | None:
        collection = self._collections.get(source)
        if collection is None or collection.cycle is None:
            return None
        return collection.cycle.rate_limited_until

    async def start(self) -> None:
        """Start the periodic cycles of every enabled source, the first ones right away. Does
        nothing when no source is enabled."""
        Scheduler._current = self
        sources = [mode for mode in DataMode.live_modes() if self.is_enabled(mode)]
        if not sources:
            logger.info("Live collection disabled on this instance")
            return

        self._jobs = AsyncIOScheduler(timezone=UTC)
        for mode in sources:
            collection = self._collections[mode]
            if collection.cycle is None:
                collection.cycle = self._build_cycle(mode)
            profile = self.profile(mode)
            if mode is DataMode.OPENSKY:
                hours = self._settings.hours_until_quota
                if hours is not None:
                    logger.warning(
                        "Anonymous OpenSky access: credits run out after {:.1f} h", hours
                    )
            self._jobs.add_job(
                self._tick,
                "interval",
                args=[mode],
                seconds=profile.period_seconds,
                id=f"{_JOB_PREFIX}{mode.value}",
                next_run_time=datetime.now(UTC) + timedelta(seconds=1),
                max_instances=1,
                coalesce=True,
                misfire_grace_time=profile.period_seconds,
            )
            logger.info(
                "{} collection started: {} every {} s",
                mode.label,
                profile.code,
                profile.period_seconds,
            )
        if DataMode.ADSBFI in sources and self._adsbfi_settings.ADSBFI_RETENTION_DAYS > 0:
            self._jobs.add_job(
                self._purge,
                "interval",
                seconds=_PURGE_PERIOD.total_seconds(),
                id=PURGE_JOB_ID,
                next_run_time=datetime.now(UTC) + _PURGE_DELAY,
                max_instances=1,
                coalesce=True,
            )
            logger.info(
                "adsb.fi observations kept {} days, purged every hour",
                self._adsbfi_settings.ADSBFI_RETENTION_DAYS,
            )
        self._jobs.start()

    async def stop(self) -> None:
        """Stop the periodic cycles, let the running ones finish, then close the connections."""
        if self._jobs is not None:
            self._jobs.shutdown(wait=False)
            self._jobs = None
        for collection in self._collections.values():
            # A cycle still running uses the HTTP client and the database: wait for its end.
            async with collection.lock:
                if collection.http is not None:
                    await collection.http.aclose()
                    collection.http = None
                    # The cycle was built on the closed client: the next start builds a new one.
                    collection.cycle = None
        if Scheduler._current is self:
            Scheduler._current = None

    async def run_now(self, source: DataMode = DataMode.OPENSKY) -> CollectionRunResult:
        """Run one cycle of the source immediately, for the Supervisor, even when paused.

        For OpenSky it uses credits.
        """
        collection = self._collections.get(source)
        if collection is None or collection.cycle is None or not self.is_enabled(source):
            raise CollectionDisabled
        if collection.lock.locked():
            raise CollectionBusy
        if collection.cycle.waiting_for_credits():
            raise CollectionRateLimited(collection.cycle.rate_limited_until, source)
        async with collection.lock:
            return await collection.cycle.run(manual=True)

    async def _tick(self, source: DataMode = DataMode.OPENSKY) -> None:
        collection = self._collections[source]
        if collection.lock.locked() or collection.cycle is None:
            return
        async with collection.lock:
            await collection.cycle.run()

    async def _purge(self) -> None:
        """Delete the adsb.fi observations older than the retention. Never raises: a failed
        purge is logged and the next one tries again."""
        if self._purger is None:
            retention = timedelta(days=self._adsbfi_settings.ADSBFI_RETENTION_DAYS)
            self._purger = ObservationPurger(retention)
        try:
            await self._purger.run()
        except Exception:
            logger.exception("adsb.fi purge failed")

    def _build_cycle(self, mode: DataMode) -> CollectionCycle:
        source: LiveSource
        if mode is DataMode.ADSBFI:
            http = httpx.AsyncClient(timeout=self._adsbfi_settings.ADSBFI_TIMEOUT_SECONDS)
            source = AdsbFiSource(AdsbFiClient(http, self._adsbfi_settings.ADSBFI_API_URL))
        else:
            settings = self._settings
            http = httpx.AsyncClient(timeout=settings.OPENSKY_TIMEOUT_SECONDS)
            token_provider = None
            if settings.has_credentials:
                token_provider = TokenProvider(
                    http,
                    settings.OPENSKY_TOKEN_URL,
                    settings.OPENSKY_CLIENT_ID,
                    settings.OPENSKY_CLIENT_SECRET.get_secret_value(),
                )
            source = OpenSkySource(OpenSkyClient(http, settings.OPENSKY_API_URL, token_provider))
        self._collections[mode].http = http
        # One flight gap for both sources (D-06).
        grouper = FlightGrouper(timedelta(minutes=self._settings.COLLECTION_FLIGHT_GAP_MINUTES))
        return CollectionCycle(DataCollector(source, self.profile(mode), grouper), state_store)
