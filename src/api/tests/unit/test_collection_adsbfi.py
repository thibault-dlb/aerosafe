"""The adsb.fi client, normaliser, source and settings, on synthetic answers only."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from config.adsbfi import AdsbFiSettings
from core.data_mode import DataMode
from services.collection.adsbfi_client import (
    REFUSED_WAIT_SECONDS,
    USER_AGENT,
    AdsbFiClient,
    AdsbFiRateLimited,
    AdsbFiUnavailable,
    AircraftResponse,
)
from services.collection.adsbfi_normalizer import AdsbFiNormalizer
from services.collection.errors import SourceRateLimited, SourceUnavailable
from services.collection.profiles import BoundingBox, Circle, ProfileCode
from services.collection.sources import AdsbFiSource

API_URL = "https://adsbfi.test/api"
NOW = 1_795_000_000.0
NOW_MS = int(NOW * 1000)
CIRCLE = Circle(48.65, 2.5, 250)


def aircraft(**changes: Any) -> dict[str, Any]:
    """A synthetic aircraft of an adsb.fi answer, with fields replaced by name."""
    fields: dict[str, Any] = {
        "hex": "3c6444",
        "type": "adsb_icao",
        "flight": "TEST123 ",
        "r": "F-TEST",
        "t": "a320",
        "desc": "TEST AIRCRAFT",
        "alt_baro": 35000,
        "alt_geom": 35500,
        "gs": 450.0,
        "track": 87.12,
        "lat": 48.9123457,
        "lon": 2.4567891,
        "seen_pos": 0.4,
        "seen": 0.2,
        "messages": 1000,
    }
    fields.update(changes)
    return {name: value for name, value in fields.items() if value is not None}


def at(seconds: float) -> datetime:
    return datetime.fromtimestamp(int(seconds), tz=UTC)


class TestNormalizer:
    def one(self, **changes: Any) -> Any:
        return AdsbFiNormalizer().normalize_one(aircraft(**changes), NOW)

    def test_an_aircraft_becomes_a_state_in_metres_and_metres_per_second(self) -> None:
        state = self.one()

        assert state.icao24 == "3c6444"
        assert state.callsign == "TEST123"
        assert state.altitude == Decimal("10668.0")  # 35 000 ft
        assert state.speed == Decimal("231.50")  # 450 kt
        assert state.heading == Decimal("87.12")
        assert (state.latitude, state.longitude) == (48.912346, 2.456789)
        assert state.on_ground is False

    def test_the_times_are_the_ages_counted_back_from_now_cut_to_the_second(self) -> None:
        state = self.one(seen=2.7, seen_pos=12.3)

        assert state.last_contact_at == at(NOW - 2.7)
        assert state.position_at == at(NOW - 12.3)

    def test_the_registration_and_the_model_describe_the_aircraft(self) -> None:
        state = self.one()

        assert (state.registration, state.model_code, state.model_label) == (
            "F-TEST",
            "A320",
            "TEST AIRCRAFT",
        )

    def test_a_model_label_without_its_code_is_dropped(self) -> None:
        state = self.one(t=None)

        assert (state.model_code, state.model_label) == (None, None)

    def test_an_aircraft_on_the_ground_has_no_altitude(self) -> None:
        state = self.one(alt_baro="ground")

        assert state.on_ground is True
        assert state.altitude is None

    def test_the_geometric_altitude_replaces_a_missing_barometric_one(self) -> None:
        assert self.one(alt_baro=None).altitude == Decimal("10820.4")  # 35 500 ft
        assert self.one(alt_baro=None, alt_geom=None).altitude is None

    @pytest.mark.parametrize("changes", [{"lat": None}, {"lon": 200}, {"seen_pos": None}])
    def test_a_position_needs_both_coordinates_and_its_age(self, changes: dict) -> None:
        state = self.one(**changes)

        assert (state.latitude, state.longitude, state.position_at) == (None, None, None)

    def test_a_position_is_never_later_than_the_last_contact(self) -> None:
        state = self.one(seen=5.0, seen_pos=1.0)

        assert state.position_at == state.last_contact_at

    @pytest.mark.parametrize(
        "changes",
        [{"hex": "~3c6444"}, {"hex": "xyz"}, {"hex": None}, {"seen": None}, {"seen": -1}],
    )
    def test_an_unusable_address_or_last_message_rejects_the_aircraft(self, changes: dict) -> None:
        assert self.one(**changes) is None

    def test_a_value_that_is_not_an_aircraft_is_rejected(self) -> None:
        result = AdsbFiNormalizer().normalize([aircraft(), "nope"], NOW)

        assert (len(result.states), result.rejected) == (1, 1)

    def test_an_aircraft_that_sent_nothing_new_is_left_out(self) -> None:
        normalizer = AdsbFiNormalizer()
        normalizer.normalize([aircraft(), aircraft(hex="4ca123")], NOW)

        result = normalizer.normalize(
            [aircraft(seen=5.2), aircraft(hex="4ca123", messages=1001)], NOW + 5
        )

        assert [state.icao24 for state in result.states] == ["4ca123"]
        assert (result.rejected, result.unchanged) == (0, 1)

    def test_an_aircraft_back_after_an_absence_is_kept(self) -> None:
        normalizer = AdsbFiNormalizer()
        normalizer.normalize([aircraft()], NOW)
        normalizer.normalize([], NOW + 5)

        assert len(normalizer.normalize([aircraft()], NOW + 10).states) == 1

    def test_an_aircraft_without_a_counter_is_always_kept(self) -> None:
        normalizer = AdsbFiNormalizer()
        normalizer.normalize([aircraft(messages=None)], NOW)

        assert len(normalizer.normalize([aircraft(messages=None)], NOW + 5).states) == 1


class Answers:
    """Answers the requests in order and keeps them, like `httpx.MockTransport` expects."""

    def __init__(self, *responses: httpx.Response | Exception) -> None:
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class Clock:
    def __init__(self) -> None:
        self.now = 100.0
        self.slept: list[float] = []

    def __call__(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


def client_on(answers: Answers, clock: Clock | None = None) -> AdsbFiClient:
    clock = clock or Clock()
    http = httpx.AsyncClient(transport=httpx.MockTransport(answers))
    return AdsbFiClient(http, API_URL + "/", clock=clock, sleep=clock.sleep)


def answer(*planes: dict[str, Any], now: int = NOW_MS) -> httpx.Response:
    return httpx.Response(200, json={"ac": list(planes), "now": now, "total": len(planes)})


class TestClient:
    async def test_the_circle_is_asked_with_a_neutral_user_agent(self) -> None:
        answers = Answers(answer(aircraft()))

        response = await client_on(answers).fetch_aircraft(CIRCLE)

        [request] = answers.requests
        assert str(request.url) == f"{API_URL}/v3/lat/48.6500/lon/2.5000/dist/250"
        assert request.headers["User-Agent"] == USER_AGENT
        assert response == AircraftResponse(now=NOW, aircraft=[aircraft()])

    def test_the_radius_is_a_whole_number_of_miles_up_to_250(self) -> None:
        client = client_on(Answers())

        assert client.url(Circle(0, 0, 0.4)).endswith("/dist/1")
        assert client.url(Circle(0, 0, 400)).endswith("/dist/250")

    async def test_an_empty_answer_has_no_aircraft(self) -> None:
        answers = Answers(httpx.Response(200, json={"ac": None, "now": NOW_MS}))

        assert (await client_on(answers).fetch_aircraft(CIRCLE)).aircraft == []

    async def test_two_requests_are_at_least_one_second_apart(self) -> None:
        clock = Clock()
        client = client_on(Answers(answer(), answer()), clock)

        await client.fetch_aircraft(CIRCLE)
        clock.now += 0.25
        await client.fetch_aircraft(CIRCLE)

        assert clock.slept == [pytest.approx(0.75)]

    async def test_a_429_waits_for_the_announced_delay(self) -> None:
        answers = Answers(httpx.Response(429, headers={"Retry-After": "30"}))

        with pytest.raises(AdsbFiRateLimited) as error:
            await client_on(answers).fetch_aircraft(CIRCLE)

        assert error.value.retry_after_seconds == 30
        assert isinstance(error.value, SourceRateLimited)

    async def test_a_429_without_delay_waits_a_minute(self) -> None:
        with pytest.raises(AdsbFiRateLimited) as error:
            await client_on(Answers(httpx.Response(429))).fetch_aircraft(CIRCLE)

        assert error.value.retry_after_seconds == REFUSED_WAIT_SECONDS

    @pytest.mark.parametrize("status", [400, 401, 403, 404])
    async def test_a_refused_request_waits_a_minute(self, status: int) -> None:
        with pytest.raises(AdsbFiRateLimited) as error:
            await client_on(Answers(httpx.Response(status))).fetch_aircraft(CIRCLE)

        assert error.value.retry_after_seconds == REFUSED_WAIT_SECONDS
        assert str(status) in str(error.value)

    @pytest.mark.parametrize(
        "response",
        [
            httpx.Response(503),
            httpx.Response(200, text="not json"),
            httpx.Response(200, json=[]),
            httpx.Response(200, json={"ac": {}, "now": NOW_MS}),
            httpx.Response(200, json={"ac": []}),
            httpx.Response(200, json={"ac": [], "now": "soon"}),
            httpx.Response(200, json={"ac": [], "now": True}),
            httpx.Response(200, json={"ac": [], "now": 0}),
        ],
    )
    async def test_an_unusable_answer_makes_the_source_unavailable(
        self, response: httpx.Response
    ) -> None:
        with pytest.raises(AdsbFiUnavailable):
            await client_on(Answers(response)).fetch_aircraft(CIRCLE)

    async def test_a_network_error_makes_the_source_unavailable(self) -> None:
        answers = Answers(httpx.ConnectTimeout("too slow"))

        with pytest.raises(SourceUnavailable, match="request failed"):
            await client_on(answers).fetch_aircraft(CIRCLE)


class TestSource:
    async def test_the_source_reads_its_circle_and_cleans_the_aircraft(self) -> None:
        answers = Answers(answer(aircraft(), aircraft(hex="~123456")))
        source = AdsbFiSource(client_on(answers))

        response = await source.fetch(CIRCLE)

        assert source.mode is DataMode.ADSBFI
        assert (response.received, response.remaining_credits) == (2, None)
        assert [state.icao24 for state in response.states.states] == ["3c6444"]
        assert response.states.rejected == 1

    async def test_the_source_refuses_a_box(self) -> None:
        source = AdsbFiSource(client_on(Answers()))

        with pytest.raises(TypeError):
            await source.fetch(BoundingBox(48.0, 49.3, 1.4, 3.6))


class TestSettings:
    def test_the_defaults_collect_250_nm_around_paris_every_5_s(self) -> None:
        settings = AdsbFiSettings(_env_file=None)

        assert settings.COLLECTION_ADSBFI_ENABLED is False
        assert settings.profile.code == ProfileCode.ADSBFI_250NM
        assert settings.profile.area == CIRCLE
        assert settings.profile.period_seconds == 5
        assert settings.ADSBFI_RETENTION_DAYS == 7

    @pytest.mark.parametrize(
        "changes",
        [
            {"ADSBFI_RADIUS_NM": 251},
            {"ADSBFI_RADIUS_NM": 0},
            {"ADSBFI_PERIOD_SECONDS": 1},
            {"ADSBFI_PERIOD_SECONDS": 3, "ADSBFI_TIMEOUT_SECONDS": 3},
            {"ADSBFI_CENTER": "48.65"},
            {"ADSBFI_CENTER": "95,2.5"},
            {"ADSBFI_RETENTION_DAYS": -1},
        ],
    )
    def test_a_setting_out_of_bounds_is_refused_at_start_up(self, changes: dict) -> None:
        with pytest.raises((ValidationError, ValueError)):
            AdsbFiSettings(_env_file=None, **changes)
