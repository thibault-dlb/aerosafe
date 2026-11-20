import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from services.collection.errors import SourceRateLimited, SourceUnavailable
from services.collection.profiles import Circle

# The public endpoints of adsb.fi accept one request per second (open data API terms).
MIN_SECONDS_BETWEEN_REQUESTS = 1.0

# A refused request (400, 401, 403, 404 or 429) counts against the limit, and too many of them
# get the address blocked for a while: after one, nothing is sent for a minute.
REFUSED_WAIT_SECONDS = 60
_REFUSED = frozenset({400, 401, 403, 404})

# A neutral name: the requests carry nothing about the people who run the application.
USER_AGENT = "AeroSafe (educational project)"


class AdsbFiUnavailable(SourceUnavailable):
    """adsb.fi is down, too slow, or answered something unusable."""


class AdsbFiRateLimited(SourceRateLimited):
    """adsb.fi refused the request: wait before the next one."""


@dataclass(frozen=True)
class AircraftResponse:
    """Raw answer of `/v3/lat/.../lon/.../dist/...`: `now` is the time of the answer in Unix
    seconds, and the ages of each aircraft count from it."""

    now: float
    aircraft: list[Any] = field(default_factory=list)


def _retry_after(response: httpx.Response) -> int:
    try:
        return max(1, int(response.headers["Retry-After"]))
    except (KeyError, ValueError):
        return REFUSED_WAIT_SECONDS


class AdsbFiClient:
    """Reads the aircraft within a circle from the adsb.fi open data API, at most once a second.

    No account and no key: the limit is per address. The data is for personal, non-commercial
    use, and adsb.fi must be cited with a link (see docs/data-sources.md).
    """

    def __init__(
        self,
        http: httpx.AsyncClient,
        api_url: str,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._http = http
        self._api_url = api_url.rstrip("/")
        self._clock = clock
        self._sleep = sleep
        self._lock = asyncio.Lock()
        self._last_request_at: float | None = None

    def url(self, circle: Circle) -> str:
        # The API takes a whole number of nautical miles, up to 250.
        radius = max(1, min(250, round(circle.radius_nm)))
        return (
            f"{self._api_url}/v3/lat/{circle.latitude:.4f}/lon/{circle.longitude:.4f}/dist/{radius}"
        )

    async def fetch_aircraft(self, circle: Circle) -> AircraftResponse:
        async with self._lock:
            await self._wait_for_the_limit()
            try:
                response = await self._http.get(
                    self.url(circle), headers={"User-Agent": USER_AGENT}
                )
            except httpx.HTTPError as error:
                raise AdsbFiUnavailable(f"adsb.fi request failed: {error!r}") from error
            finally:
                self._last_request_at = self._clock()
        return self._read(response)

    async def _wait_for_the_limit(self) -> None:
        if self._last_request_at is None:
            return
        elapsed = self._clock() - self._last_request_at
        if elapsed < MIN_SECONDS_BETWEEN_REQUESTS:
            await self._sleep(MIN_SECONDS_BETWEEN_REQUESTS - elapsed)

    @staticmethod
    def _read(response: httpx.Response) -> AircraftResponse:
        status = response.status_code
        if status == httpx.codes.TOO_MANY_REQUESTS:
            wait = _retry_after(response)
            raise AdsbFiRateLimited(f"adsb.fi rate limit reached, retry after {wait} s", wait)
        if status in _REFUSED:
            raise AdsbFiRateLimited(
                f"adsb.fi refused the request ({status}), retry after {REFUSED_WAIT_SECONDS} s",
                REFUSED_WAIT_SECONDS,
            )
        if status != httpx.codes.OK:
            raise AdsbFiUnavailable(f"adsb.fi answered {status}")
        try:
            body = response.json()
            # `ac` is null when no aircraft is in the circle.
            aircraft = body.get("ac")
            aircraft = [] if aircraft is None else aircraft
            now = body["now"]
            if not isinstance(aircraft, list):
                raise TypeError("ac is not a list")
            if isinstance(now, bool) or not isinstance(now, int | float) or now <= 0:
                raise TypeError("now is not a time")
        except (ValueError, AttributeError, KeyError, TypeError) as error:
            raise AdsbFiUnavailable(f"Unreadable adsb.fi answer: {error}") from error
        # `now` is in milliseconds.
        return AircraftResponse(now=now / 1000, aircraft=aircraft)
