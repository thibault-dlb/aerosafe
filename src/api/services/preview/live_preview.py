import asyncio
import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field

import httpx

from config.adsbfi import AdsbFiSettings
from config.adsbfi import settings as adsbfi_default_settings
from config.opensky import OpenSkySettings
from config.opensky import settings as opensky_default_settings
from core.data_mode import DataMode
from schemas.aircraft import AircraftSummary
from services.collection.adsbfi_client import AdsbFiClient
from services.collection.clients import LiveClient, build_live_client
from services.collection.errors import SourceError, SourceRateLimited
from services.collection.normalizer import NormalizedState
from services.collection.profiles import CollectionProfile
from services.collection.sources import AdsbFiSource, LiveSource, OpenSkySource

ClientBuilder = Callable[
    [DataMode, OpenSkySettings, AdsbFiSettings], tuple[LiveClient, httpx.AsyncClient]
]


class PreviewUnavailable(Exception):
    """The source cannot be read now. `retry_after_seconds` is how long to wait, when known."""

    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


@dataclass
class _Feed:
    """What the preview holds for one source: its client, the last answer and its deadline."""

    client: LiveClient | None = None
    http: httpx.AsyncClient | None = None
    aircraft: list[AircraftSummary] = field(default_factory=list)
    fresh_until: float | None = None
    blocked_until: float | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class LivePreview:
    """The traffic of a live source read on demand, for the dashboard of an instance that does
    not collect it. Nothing is written to the database: no history, no flights, no alerts.

    The answer is kept for one period of the source, whoever asks, so many open dashboards cost
    one request. A source that refuses requests is left alone until the delay it announced is
    over. It reads through the same clients as the collection, with the same account.
    """

    def __init__(
        self,
        opensky_settings: OpenSkySettings | None = None,
        adsbfi_settings: AdsbFiSettings | None = None,
        clock: Callable[[], float] = time.monotonic,
        builder: ClientBuilder = build_live_client,
    ) -> None:
        self._opensky = opensky_settings or opensky_default_settings
        self._adsbfi = adsbfi_settings or adsbfi_default_settings
        self._clock = clock
        self._builder = builder
        self._feeds = {mode: _Feed() for mode in DataMode.live_modes()}

    def profile(self, mode: DataMode) -> CollectionProfile:
        return self._adsbfi.profile if mode is DataMode.ADSBFI else self._opensky.profile

    async def aircraft(self, mode: DataMode) -> list[AircraftSummary]:
        """The aircraft of the area of the source, as it sees them now."""
        feed = self._feeds.get(mode)
        if feed is None:
            raise ValueError(f"{mode.label} is not a live source")
        async with feed.lock:
            now = self._clock()
            if feed.blocked_until is not None and now < feed.blocked_until:
                wait = math.ceil(feed.blocked_until - now)
                raise PreviewUnavailable(f"{mode.label} refuses requests for {wait} s", wait)
            if feed.fresh_until is not None and now < feed.fresh_until:
                return feed.aircraft
            feed.aircraft = await self._read(mode, feed)
            feed.fresh_until = self._clock() + self.profile(mode).period_seconds
            return feed.aircraft

    async def close(self) -> None:
        """Close the connections opened so far; a later call opens new ones."""
        for feed in self._feeds.values():
            async with feed.lock:
                if feed.http is not None:
                    await feed.http.aclose()
                feed.client = feed.http = None
                feed.fresh_until = None

    async def _read(self, mode: DataMode, feed: _Feed) -> list[AircraftSummary]:
        if feed.client is None:
            feed.client, feed.http = self._builder(mode, self._opensky, self._adsbfi)
        # A new source for each read: the adsb.fi one drops the aircraft that sent nothing new
        # since its previous answer, which suits a collection but would empty a map.
        source: LiveSource = (
            AdsbFiSource(feed.client)
            if isinstance(feed.client, AdsbFiClient)
            else OpenSkySource(feed.client)
        )
        try:
            response = await source.fetch(self.profile(mode).area)
        except SourceRateLimited as error:
            wait = error.retry_after_seconds or self.profile(mode).period_seconds
            feed.blocked_until = self._clock() + wait
            raise PreviewUnavailable(str(error), wait) from error
        except SourceError as error:
            raise PreviewUnavailable(str(error)) from error
        return [self.to_summary(state) for state in response.states.states]

    @staticmethod
    def to_summary(state: NormalizedState) -> AircraftSummary:
        """A state as the aircraft search gives it. There is no database key: the address
        identifies the aircraft, which is enough for a map and its follow."""
        return AircraftSummary(
            id=state.icao24,
            icao24=state.icao24,
            registration=state.registration,
            model=state.model_label,
            last_contact_at=state.last_contact_at,
            latitude=state.latitude,
            longitude=state.longitude,
            altitude=None if state.altitude is None else float(state.altitude),
            heading=None if state.heading is None else float(state.heading),
            on_ground=state.on_ground,
            speed=None if state.speed is None else float(state.speed),
        )


# One for the whole process: it holds the answers and the connections.
live_preview = LivePreview()
