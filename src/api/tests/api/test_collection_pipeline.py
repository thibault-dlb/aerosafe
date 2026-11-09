"""The collection endpoints with the real pipeline behind them.

Only the edges are replaced: OpenSky answers through an `httpx.MockTransport`, and the
observations, sessions and rules engine are kept in memory. The OpenSky client, the
normaliser, the flight grouper, the collector, the cycle and the scheduler are the real ones.
"""

from collections.abc import AsyncGenerator, AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

from config.opensky import OpenSkySettings
from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.collection import get_scheduler
from services.collection.collector import DataCollector
from services.collection.cycle import CollectionCycle
from services.collection.flight_grouper import FlightDecision, FlightGrouper, OpenFlight
from services.collection.normalizer import NormalizedState
from services.collection.opensky_client import OpenSkyClient, TokenProvider
from services.collection.run_repository import get_state_store
from services.collection.run_state import InMemoryCollectionStateStore, RunStatus
from services.collection.scheduler import Scheduler

API_URL = "https://opensky.test/api"
TOKEN_URL = "https://auth.opensky.test/token"
CONTACT = int(datetime.now(UTC).timestamp()) - 5

Handler = Callable[[httpx.Request], httpx.Response]


def state_vector(icao24: str, last_contact: float = CONTACT, **changes: Any) -> list[Any]:
    """A state vector of /states/all, with fields replaced by name."""
    fields: dict[str, Any] = {
        "icao24": icao24,
        "callsign": "AFR123  ",
        "origin_country": "France",
        "time_position": last_contact - 1,
        "last_contact": last_contact,
        "longitude": 2.5478312,
        "latitude": 49.0097123,
        "baro_altitude": 10972.8,
        "on_ground": False,
        "velocity": 231.456,
        "true_track": 87.125,
        "vertical_rate": 0.0,
        "sensors": None,
        "geo_altitude": 11277.6,
    }
    fields.update(changes)
    return list(fields.values())


class FakeOpenSky:
    """Answers the token and state requests in order, and keeps the requests it received."""

    def __init__(self, *state_answers: httpx.Response) -> None:
        self._state_answers = list(state_answers)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if str(request.url) == TOKEN_URL:
            return httpx.Response(200, json={"access_token": "token", "expires_in": 1800})
        return self._state_answers.pop(0)

    @property
    def token_requests(self) -> int:
        return sum(str(request.url) == TOKEN_URL for request in self.requests)

    @property
    def state_requests(self) -> list[httpx.Request]:
        return [request for request in self.requests if str(request.url) != TOKEN_URL]


def states(*vectors: Any, remaining: int = 3_990) -> httpx.Response:
    return httpx.Response(
        200,
        json={"time": CONTACT, "states": list(vectors)},
        headers={"X-Rate-Limit-Remaining": str(remaining)},
    )


class MemoryObservationStore:
    """Groups the observations into flights with the real grouper, without a database."""

    observations: list[NormalizedState]
    flights: dict[str, OpenFlight]
    started: int

    def __init__(self, _session: Any, grouper: FlightGrouper) -> None:
        self._grouper = grouper

    async def save(self, normalized: list[NormalizedState]) -> int:
        for state in normalized:
            current = self.flights.get(state.icao24)
            if self._grouper.decide(current, state) is FlightDecision.NEW:
                MemoryObservationStore.started += 1
                flight_id = MemoryObservationStore.started
            else:
                assert current is not None
                flight_id = current.flight_id or 0
            self.flights[state.icao24] = OpenFlight(
                flight_id, state.callsign, state.last_contact_at
            )
            self.observations.append(state)
        return len(normalized)

    async def close_stale_flights(self, now: datetime) -> int:
        stale = [
            icao24
            for icao24, flight in self.flights.items()
            if flight.last_seen_at < self._grouper.stale_before(now)
        ]
        for icao24 in stale:
            del self.flights[icao24]
        return len(stale)


@asynccontextmanager
async def memory_session() -> AsyncIterator[AsyncMock]:
    yield AsyncMock()


class Engine:
    def __init__(self, _session: Any) -> None:
        pass

    async def evaluate(self, _now: datetime) -> None:
        return None


def settings() -> OpenSkySettings:
    return OpenSkySettings(
        _env_file=None,
        COLLECTION_ENABLED=True,
        OPENSKY_API_URL=API_URL,
        OPENSKY_TOKEN_URL=TOKEN_URL,
        OPENSKY_CLIENT_ID="group",
        OPENSKY_CLIENT_SECRET="secret",
    )


@pytest.fixture
def store() -> InMemoryCollectionStateStore:
    return InMemoryCollectionStateStore()


@pytest.fixture(autouse=True)
def memory_observations() -> None:
    MemoryObservationStore.observations = []
    MemoryObservationStore.flights = {}
    MemoryObservationStore.started = 0


@pytest.fixture
async def client(store: InMemoryCollectionStateStore) -> AsyncGenerator[httpx.AsyncClient, None]:
    app.dependency_overrides[get_state_store] = lambda: store
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        5, new_ulid(), RoleCode.SUPERVISOR
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


def use_opensky(opensky: FakeOpenSky, store: InMemoryCollectionStateStore) -> Scheduler:
    """A scheduler whose cycle reads the fake OpenSky, given to the endpoints."""
    config = settings()
    http = httpx.AsyncClient(transport=httpx.MockTransport(opensky))
    tokens = TokenProvider(http, TOKEN_URL, "group", "secret")
    collector = DataCollector(
        OpenSkyClient(http, API_URL, tokens),
        config.profile,
        FlightGrouper(timedelta(minutes=config.COLLECTION_FLIGHT_GAP_MINUTES)),
        store_factory=MemoryObservationStore,  # type: ignore[arg-type]
    )
    cycle = CollectionCycle(
        collector,
        store,
        session_factory=memory_session,
        engine_factory=Engine,  # type: ignore[arg-type]
    )
    scheduler = Scheduler(config, cycle)
    app.dependency_overrides[get_scheduler] = lambda: scheduler
    return scheduler


async def test_a_manual_run_reads_cleans_and_records_the_states(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    opensky = FakeOpenSky(
        states(
            state_vector("3C6444"),
            # The same aircraft, older: the latest state is kept.
            state_vector("3c6444", CONTACT - 10),
            # On the ground, without a position: stored with empty coordinates.
            state_vector("4ca1fa", on_ground=True, latitude=None),
            # Out-of-range values empty their fields only.
            state_vector("39c902", velocity=1e30, baro_altitude=None, geo_altitude=10**400),
            # Rejected: invalid ICAO24 address, and not a state vector at all.
            state_vector("nope"),
            {"icao24": "3c6444"},
        )
    )
    use_opensky(opensky, store)

    response = await client.post("/api/v1/collection/run")

    assert response.status_code == 200
    run = response.json()
    assert run["status"] == RunStatus.PARTIAL
    assert (run["received"], run["stored"], run["rejected"]) == (6, 3, 2)
    assert run["remaining_credits"] == 3_990
    assert run["evaluation_error"] is None

    [request] = opensky.state_requests
    assert request.headers["Authorization"] == "Bearer token"
    assert request.url.params["lamin"] == "48.0"

    stored = {state.icao24: state for state in MemoryObservationStore.observations}
    assert set(stored) == {"3c6444", "4ca1fa", "39c902"}
    assert stored["3c6444"].callsign == "AFR123"
    assert not stored["4ca1fa"].has_position and stored["4ca1fa"].on_ground
    assert stored["39c902"].speed is None and stored["39c902"].altitude is None

    status = (await client.get("/api/v1/collection/status")).json()
    assert status["enabled"] is True and status["authenticated"] is True
    assert status["running"] is False
    assert status["daily_quota"] == 4_000
    assert status["last_run"]["status"] == RunStatus.PARTIAL
    assert status["last_success"]["stored"] == 3
    assert [run["status"] for run in (await client.get("/api/v1/collection/runs")).json()] == [
        RunStatus.PARTIAL
    ]


async def test_the_next_runs_group_the_observations_into_flights(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    opensky = FakeOpenSky(
        # Last seen an hour ago: its flight is closed at the end of the run.
        states(state_vector("3c6444", CONTACT - 600), state_vector("39c902", CONTACT - 3_600)),
        # Within the gap with the same callsign: the same flight; a new aircraft: a new one.
        states(state_vector("3c6444", CONTACT - 300), state_vector("4ca1fa")),
    )
    use_opensky(opensky, store)

    first = (await client.post("/api/v1/collection/run")).json()
    second = (await client.post("/api/v1/collection/run")).json()

    assert (first["status"], second["status"]) == (RunStatus.SUCCESS, RunStatus.SUCCESS)
    flights = MemoryObservationStore.flights
    assert {icao24: flight.flight_id for icao24, flight in flights.items()} == {
        "3c6444": 1,
        "4ca1fa": 3,
    }
    assert opensky.token_requests == 1


async def test_an_expired_token_is_renewed_once(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    opensky = FakeOpenSky(httpx.Response(401), states(state_vector("3c6444")))
    use_opensky(opensky, store)

    response = await client.post("/api/v1/collection/run")

    assert response.json()["status"] == RunStatus.SUCCESS
    assert opensky.token_requests == 2


async def test_a_429_is_recorded_and_refuses_the_next_manual_run(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    opensky = FakeOpenSky(httpx.Response(429, headers={"X-Rate-Limit-Retry-After-Seconds": "600"}))
    use_opensky(opensky, store)

    limited = await client.post("/api/v1/collection/run")
    assert limited.json()["status"] == RunStatus.RATE_LIMITED

    refused = await client.post("/api/v1/collection/run")
    assert refused.status_code == 409
    assert "OpenSky credits are used up" in refused.json()["detail"]
    assert len(opensky.state_requests) == 1

    status = (await client.get("/api/v1/collection/status")).json()
    assert status["rate_limited_until"] is not None
    assert status["last_success"] is None


@pytest.mark.parametrize(
    ("answer", "error"),
    [
        (httpx.Response(503), "OpenSky answered 503"),
        (httpx.Response(200, text="not json"), "Unreadable OpenSky answer"),
    ],
)
async def test_an_unusable_answer_fails_the_run(
    client: httpx.AsyncClient,
    store: InMemoryCollectionStateStore,
    answer: httpx.Response,
    error: str,
) -> None:
    use_opensky(FakeOpenSky(answer), store)

    run = (await client.post("/api/v1/collection/run")).json()

    assert run["status"] == RunStatus.FAILED
    assert error in run["error"]
    assert MemoryObservationStore.observations == []


async def test_a_manual_run_collects_during_a_pause(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    use_opensky(FakeOpenSky(states(state_vector("3c6444"))), store)

    assert (await client.post("/api/v1/collection/pause")).json()["paused"] is True
    run = (await client.post("/api/v1/collection/run")).json()

    assert run["status"] == RunStatus.SUCCESS
    assert (await client.get("/api/v1/collection/status")).json()["paused"] is True


async def test_a_started_scheduler_serves_the_endpoints_then_stops(
    client: httpx.AsyncClient, store: InMemoryCollectionStateStore
) -> None:
    scheduler = use_opensky(FakeOpenSky(states(state_vector("3c6444"))), store)
    app.dependency_overrides.pop(get_scheduler)

    await scheduler.start()
    try:
        assert Scheduler.current() is scheduler
        assert (await client.get("/api/v1/collection/status")).json()["enabled"] is True
        assert (await client.post("/api/v1/collection/run")).json()["stored"] == 1
    finally:
        await scheduler.stop()

    assert Scheduler.current() is None
    assert (await client.get("/api/v1/collection/status")).json()["last_run"]["stored"] == 1
