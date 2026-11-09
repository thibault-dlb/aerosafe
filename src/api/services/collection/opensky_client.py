import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from services.collection.profiles import BoundingBox

# Renew the token a little before OpenSky expires it.
_TOKEN_MARGIN_SECONDS = 60


class OpenSkyError(Exception):
    """Base error of the OpenSky client. The collector never lets it reach the API."""


class OpenSkyUnavailable(OpenSkyError):
    """OpenSky is down, too slow, or answered something unusable."""


class OpenSkyRateLimited(OpenSkyError):
    """OpenSky answered 429: the daily credits are used up."""

    def __init__(self, retry_after_seconds: int | None) -> None:
        super().__init__(f"OpenSky rate limit reached, retry after {retry_after_seconds} s")
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class StatesResponse:
    """Raw answer of /states/all: state vectors are lists, decoded by the normaliser."""

    time: int | None
    states: list[list[Any]] = field(default_factory=list)
    remaining_credits: int | None = None


def _int_header(response: httpx.Response, name: str) -> int | None:
    try:
        return int(response.headers[name])
    except (KeyError, ValueError):
        return None


class TokenProvider:
    """OAuth2 client credentials flow of OpenSky. The token lasts 30 minutes."""

    def __init__(
        self,
        http: httpx.AsyncClient,
        token_url: str,
        client_id: str,
        client_secret: str,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._http = http
        self._token_url = token_url
        self._client_id = client_id
        self._client_secret = client_secret
        self._clock = clock
        self._token: str | None = None
        self._expires_at = 0.0

    async def token(self) -> str:
        if self._token is None or self._clock() >= self._expires_at:
            await self._renew()
        assert self._token is not None
        return self._token

    def invalidate(self) -> None:
        self._token = None

    async def _renew(self) -> None:
        try:
            response = await self._http.post(
                self._token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            response.raise_for_status()
            body = response.json()
            token = body["access_token"]
            lifetime = float(body.get("expires_in", 1800))
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise OpenSkyUnavailable(f"Cannot get an OpenSky token: {error}") from error
        self._token = token
        self._expires_at = self._clock() + max(lifetime - _TOKEN_MARGIN_SECONDS, 0)


class OpenSkyClient:
    """Reads the live state vectors of an area. Anonymous when no token provider is given."""

    def __init__(
        self,
        http: httpx.AsyncClient,
        api_url: str,
        token_provider: TokenProvider | None = None,
    ) -> None:
        self._http = http
        self._states_url = f"{api_url.rstrip('/')}/states/all"
        self._token_provider = token_provider

    @property
    def authenticated(self) -> bool:
        return self._token_provider is not None

    async def fetch_states(self, bounding_box: BoundingBox) -> StatesResponse:
        response = await self._get(bounding_box)
        if response.status_code == httpx.codes.UNAUTHORIZED and self._token_provider:
            # The token expired early: renew it once.
            self._token_provider.invalidate()
            response = await self._get(bounding_box)
        return self._read(response)

    async def _get(self, bounding_box: BoundingBox) -> httpx.Response:
        headers = {}
        if self._token_provider:
            headers["Authorization"] = f"Bearer {await self._token_provider.token()}"
        try:
            return await self._http.get(
                self._states_url, params=bounding_box.as_query(), headers=headers
            )
        except httpx.HTTPError as error:
            raise OpenSkyUnavailable(f"OpenSky request failed: {error!r}") from error

    @staticmethod
    def _read(response: httpx.Response) -> StatesResponse:
        if response.status_code == httpx.codes.TOO_MANY_REQUESTS:
            raise OpenSkyRateLimited(_int_header(response, "X-Rate-Limit-Retry-After-Seconds"))
        if response.status_code != httpx.codes.OK:
            raise OpenSkyUnavailable(f"OpenSky answered {response.status_code}")
        try:
            body = response.json()
            states = body.get("states") or []
            if not isinstance(states, list):
                raise TypeError("states is not a list")
        except (ValueError, AttributeError, TypeError) as error:
            raise OpenSkyUnavailable(f"Unreadable OpenSky answer: {error}") from error
        return StatesResponse(
            time=body.get("time"),
            states=[state for state in states if isinstance(state, list)],
            remaining_credits=_int_header(response, "X-Rate-Limit-Remaining"),
        )
