from collections.abc import Callable

import httpx
import pytest

from services.collection.opensky_client import (
    OpenSkyClient,
    OpenSkyRateLimited,
    OpenSkyUnavailable,
    TokenProvider,
)
from services.collection.profiles import BoundingBox

API_URL = "https://opensky.test/api"
TOKEN_URL = "https://auth.opensky.test/token"
BOX = BoundingBox(48.0, 49.3, 1.4, 3.6)
STATE = ["3c6444", "DLH9LF  ", "Germany", 1_700_000_000, 1_700_000_001]

Handler = Callable[[httpx.Request], httpx.Response]


def http_client(handler: Handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def anonymous(handler: Handler) -> OpenSkyClient:
    return OpenSkyClient(http_client(handler), API_URL)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


async def test_states_are_read_with_the_remaining_credits() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={"time": 1_700_000_005, "states": [STATE, "not a state"]},
            headers={"X-Rate-Limit-Remaining": "321"},
        )

    response = await anonymous(handler).fetch_states(BOX)

    assert response.time == 1_700_000_005
    # The normaliser rejects what is not a state vector, so the run counts it.
    assert response.states == [STATE, "not a state"]
    assert response.remaining_credits == 321
    assert seen[0].url.path == "/api/states/all"
    assert seen[0].url.params["lamin"] == "48.0"
    assert "Authorization" not in seen[0].headers


async def test_an_empty_area_gives_no_state() -> None:
    client = anonymous(lambda _request: httpx.Response(200, json={"time": 1, "states": None}))

    response = await client.fetch_states(BOX)

    assert response.states == []
    assert response.remaining_credits is None


async def test_a_429_gives_the_wait_announced_by_opensky() -> None:
    client = anonymous(
        lambda _request: httpx.Response(429, headers={"X-Rate-Limit-Retry-After-Seconds": "1200"})
    )

    with pytest.raises(OpenSkyRateLimited) as error:
        await client.fetch_states(BOX)

    assert error.value.retry_after_seconds == 1200


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(503),
        httpx.Response(200, content=b"<html>"),
        httpx.Response(200, json=["not", "an", "object"]),
        httpx.Response(200, json={"states": "nope"}),
    ],
)
async def test_an_unusable_answer_means_unavailable(response: httpx.Response) -> None:
    with pytest.raises(OpenSkyUnavailable):
        await anonymous(lambda _request: response).fetch_states(BOX)


async def test_a_network_error_means_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("too slow", request=request)

    with pytest.raises(OpenSkyUnavailable):
        await anonymous(handler).fetch_states(BOX)


def authenticated(handler: Handler, clock: FakeClock) -> OpenSkyClient:
    http = http_client(handler)
    provider = TokenProvider(http, TOKEN_URL, "group", "secret", clock=clock)
    return OpenSkyClient(http, API_URL, provider)


async def test_the_token_is_sent_and_reused_until_it_expires() -> None:
    clock = FakeClock()
    tokens = iter(["first", "second"])
    authorizations: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "auth.opensky.test":
            assert b"grant_type=client_credentials" in request.content
            return httpx.Response(200, json={"access_token": next(tokens), "expires_in": 1800})
        authorizations.append(request.headers["Authorization"])
        return httpx.Response(200, json={"states": []})

    client = authenticated(handler, clock)
    assert client.authenticated

    await client.fetch_states(BOX)
    clock.now = 1000
    await client.fetch_states(BOX)
    clock.now = 1800
    await client.fetch_states(BOX)

    assert authorizations == ["Bearer first", "Bearer first", "Bearer second"]


async def test_a_401_renews_the_token_once() -> None:
    tokens = iter(["stale", "fresh"])

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "auth.opensky.test":
            return httpx.Response(200, json={"access_token": next(tokens)})
        if request.headers["Authorization"] == "Bearer stale":
            return httpx.Response(401)
        return httpx.Response(200, json={"states": [STATE]})

    response = await authenticated(handler, FakeClock()).fetch_states(BOX)

    assert response.states == [STATE]


async def test_a_refused_token_means_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_client"})

    with pytest.raises(OpenSkyUnavailable, match="token"):
        await authenticated(handler, FakeClock()).fetch_states(BOX)
