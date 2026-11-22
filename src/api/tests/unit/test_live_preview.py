from typing import Any

import httpx
import pytest

from config.adsbfi import AdsbFiSettings
from config.opensky import OpenSkySettings
from core.data_mode import DataMode
from services.collection.adsbfi_client import (
    AdsbFiClient,
    AdsbFiRateLimited,
    AdsbFiUnavailable,
    AircraftResponse,
)
from services.collection.clients import LiveClient
from services.collection.opensky_client import OpenSkyClient, StatesResponse
from services.collection.profiles import BoundingBox
from services.preview import LivePreview, PreviewUnavailable

from .test_collection_normalizer import raw_state

NOW = 1_700_000_100.0
PLANE = {
    "hex": "3c6444",
    "flight": "DLH9LF",
    "lat": 48.8,
    "lon": 2.3,
    "alt_baro": 35000,
    "gs": 450,
    "track": 90,
    "seen": 1.0,
    "seen_pos": 1.0,
    "messages": 10,
    "r": "D-AIBD",
    "t": "A319",
    "desc": "AIRBUS A-319",
}


class FakeAdsbFi(AdsbFiClient):
    """Answers one outcome after the other, the last one for good."""

    def __init__(self, *outcomes: Any) -> None:
        self.outcomes = list(outcomes)
        self.calls = 0

    async def fetch_aircraft(self, circle: Any) -> Any:
        self.calls += 1
        outcome = self.outcomes.pop(0) if len(self.outcomes) > 1 else self.outcomes[0]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class FakeOpenSky(OpenSkyClient):
    def __init__(self, response: StatesResponse) -> None:
        self.response = response
        self.boxes: list[BoundingBox] = []

    async def fetch_states(self, bounding_box: BoundingBox) -> StatesResponse:
        self.boxes.append(bounding_box)
        return self.response


class Clock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


class Builder:
    """Hands the same fake client to every build, and counts the connections it opens."""

    def __init__(self, client: LiveClient) -> None:
        self.client = client
        self.connections: list[httpx.AsyncClient] = []

    def __call__(
        self, _mode: DataMode, _opensky: OpenSkySettings, _adsbfi: AdsbFiSettings
    ) -> tuple[LiveClient, httpx.AsyncClient]:
        http = httpx.AsyncClient()
        self.connections.append(http)
        return self.client, http


def preview_of(client: LiveClient, clock: Clock | None = None) -> tuple[LivePreview, Builder]:
    builder = Builder(client)
    preview = LivePreview(
        OpenSkySettings(_env_file=None),
        AdsbFiSettings(_env_file=None),
        clock=clock or Clock(),
        builder=builder,
    )
    return preview, builder


async def test_the_aircraft_of_adsbfi_are_read_as_the_search_gives_them() -> None:
    preview, _ = preview_of(FakeAdsbFi(_answer(PLANE)))

    [plane] = await preview.aircraft(DataMode.ADSBFI)

    assert plane.id == plane.icao24 == "3c6444"
    assert plane.registration == "D-AIBD"
    assert plane.model == "AIRBUS A-319"
    assert (plane.latitude, plane.longitude) == (48.8, 2.3)
    assert plane.altitude == pytest.approx(10668.0)
    assert plane.speed == pytest.approx(231.5, abs=0.1)
    assert plane.heading == 90.0
    assert plane.on_ground is False
    assert plane.airline is None


async def test_the_aircraft_of_opensky_are_read_in_its_box() -> None:
    client = FakeOpenSky(StatesResponse(time=1, states=[raw_state()], remaining_credits=390))
    preview, _ = preview_of(client)

    [plane] = await preview.aircraft(DataMode.OPENSKY)

    assert plane.icao24 == "3c6444"
    assert client.boxes == [OpenSkySettings(_env_file=None).profile.area]


async def test_the_answer_is_shared_for_one_period() -> None:
    clock = Clock()
    client = FakeAdsbFi(_answer(PLANE))
    preview, _ = preview_of(client, clock)
    period = preview.profile(DataMode.ADSBFI).period_seconds

    await preview.aircraft(DataMode.ADSBFI)
    clock.now += period - 1
    await preview.aircraft(DataMode.ADSBFI)
    assert client.calls == 1

    clock.now += 1
    await preview.aircraft(DataMode.ADSBFI)
    assert client.calls == 2


async def test_an_aircraft_that_sent_nothing_new_stays_on_the_map() -> None:
    """The collection leaves it out, but a map that did would lose it every other answer."""
    clock = Clock()
    preview, _ = preview_of(FakeAdsbFi(_answer(PLANE)), clock)

    first = await preview.aircraft(DataMode.ADSBFI)
    clock.now += 60
    second = await preview.aircraft(DataMode.ADSBFI)

    assert len(first) == len(second) == 1


async def test_a_source_that_refuses_is_left_alone_until_its_delay_is_over() -> None:
    clock = Clock()
    client = FakeAdsbFi(AdsbFiRateLimited("slow down", 30), _answer(PLANE))
    preview, _ = preview_of(client, clock)

    with pytest.raises(PreviewUnavailable) as first:
        await preview.aircraft(DataMode.ADSBFI)
    assert first.value.retry_after_seconds == 30

    clock.now += 10
    with pytest.raises(PreviewUnavailable) as second:
        await preview.aircraft(DataMode.ADSBFI)
    assert second.value.retry_after_seconds == 20
    assert client.calls == 1

    clock.now += 20
    assert len(await preview.aircraft(DataMode.ADSBFI)) == 1
    assert client.calls == 2


async def test_a_source_that_is_down_is_asked_again_at_the_next_read() -> None:
    client = FakeAdsbFi(AdsbFiUnavailable("down"), _answer(PLANE))
    preview, _ = preview_of(client)

    with pytest.raises(PreviewUnavailable) as failure:
        await preview.aircraft(DataMode.ADSBFI)
    assert failure.value.retry_after_seconds is None

    assert len(await preview.aircraft(DataMode.ADSBFI)) == 1


async def test_the_replay_is_not_a_live_source() -> None:
    preview, _ = preview_of(FakeAdsbFi(_answer(PLANE)))

    with pytest.raises(ValueError, match="not a live source"):
        await preview.aircraft(DataMode.REPLAY)


async def test_closing_closes_the_connections_and_a_later_read_opens_new_ones() -> None:
    preview, builder = preview_of(FakeAdsbFi(_answer(PLANE)))
    await preview.aircraft(DataMode.ADSBFI)

    await preview.close()
    assert builder.connections[0].is_closed

    await preview.aircraft(DataMode.ADSBFI)
    assert len(builder.connections) == 2


def _answer(*aircraft: dict[str, Any]) -> AircraftResponse:
    return AircraftResponse(now=NOW, aircraft=list(aircraft))
