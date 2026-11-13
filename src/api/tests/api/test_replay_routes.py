from collections.abc import AsyncGenerator
from datetime import timedelta

import httpx
import pytest

from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from services.replay import ReplayService, ReplayState
from services.replay.dependencies import get_replay_service
from tests.replay_support import BOUNDS, END, REAL, START, T0, Clock, MemoryReplayStore

SUPERVISOR = CurrentUser(5, new_ulid(), RoleCode.SUPERVISOR)
USER = CurrentUser(6, new_ulid(), RoleCode.USER)


def use(store: MemoryReplayStore, caller: CurrentUser = SUPERVISOR) -> Clock:
    clock = Clock()
    replay = ReplayService(store, clock)
    app.dependency_overrides[get_replay_service] = lambda: replay
    app.dependency_overrides[get_current_user] = lambda: caller
    return clock


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


def start_body(at=T0, speed: int = 10) -> dict:
    return {"at": at.isoformat(), "speed": speed}


async def test_the_clock_is_readable_by_every_user(client: httpx.AsyncClient) -> None:
    use(MemoryReplayStore(), USER)

    response = await client.get("/api/v1/replay")

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["start"] == START.isoformat().replace("+00:00", "Z")
    assert body["simulated_at"] is None
    assert body["paused"] is True
    assert body["allowed_speeds"] == [1, 10, 60]


async def test_the_clock_needs_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    app.dependency_overrides[get_replay_service] = lambda: ReplayService(MemoryReplayStore())

    response = await client.get("/api/v1/replay")

    assert response.status_code == 401


async def test_a_supervisor_starts_the_replay_for_everyone(client: httpx.AsyncClient) -> None:
    store = MemoryReplayStore()
    use(store)

    response = await client.post("/api/v1/replay/start", json=start_body())

    assert response.status_code == 200
    body = response.json()
    assert body["simulated_at"] == T0.isoformat().replace("+00:00", "Z")
    assert (body["speed"], body["paused"], body["finished"]) == (10, False, False)
    assert store.saved[-1].changed_by_id == SUPERVISOR.id
    assert store.resets == [T0]


async def test_a_simple_user_cannot_drive_the_replay(client: httpx.AsyncClient) -> None:
    store = MemoryReplayStore(ReplayState(T0, REAL, 1, False))
    use(store, USER)

    for path, body in [
        ("start", start_body()),
        ("pause", None),
        ("resume", None),
        ("speed", {"speed": 10}),
    ]:
        response = await client.post(f"/api/v1/replay/{path}", json=body)
        assert response.status_code == 403, path

    assert store.saved == []


@pytest.mark.parametrize(
    "body",
    [
        {"at": "2022-08-14T15:00:00", "speed": 1},  # no time zone
        {"at": "yesterday", "speed": 1},
        {"speed": 1},
    ],
)
async def test_a_start_without_a_valid_instant_is_refused(
    client: httpx.AsyncClient, body: dict
) -> None:
    use(MemoryReplayStore())

    assert (await client.post("/api/v1/replay/start", json=body)).status_code == 422


async def test_an_instant_outside_the_data_is_refused(client: httpx.AsyncClient) -> None:
    store = MemoryReplayStore()
    use(store)

    response = await client.post("/api/v1/replay/start", json=start_body(END + timedelta(days=1)))

    assert response.status_code == 422
    assert "covers" in response.json()["detail"]
    assert store.saved == []


async def test_a_speed_that_is_not_allowed_is_refused(client: httpx.AsyncClient) -> None:
    use(MemoryReplayStore())

    assert (await client.post("/api/v1/replay/start", json=start_body(speed=3))).status_code == 422


async def test_without_replayed_data_the_replay_cannot_start(client: httpx.AsyncClient) -> None:
    use(MemoryReplayStore(bounds=None))

    response = await client.post("/api/v1/replay/start", json=start_body())

    assert response.status_code == 409


async def test_the_clock_is_paused_resumed_and_sped_up(client: httpx.AsyncClient) -> None:
    store = MemoryReplayStore(ReplayState(T0, REAL, 1, False))
    clock = use(store)
    clock.advance(timedelta(seconds=20))

    paused = (await client.post("/api/v1/replay/pause")).json()
    assert paused["paused"] is True
    assert paused["simulated_at"] == (T0 + timedelta(seconds=20)).isoformat().replace("+00:00", "Z")

    resumed = (await client.post("/api/v1/replay/resume")).json()
    assert resumed["paused"] is False

    faster = (await client.post("/api/v1/replay/speed", json={"speed": 60})).json()
    assert faster["speed"] == 60


async def test_a_clock_that_never_started_cannot_be_paused_resumed_or_sped_up(
    client: httpx.AsyncClient,
) -> None:
    use(MemoryReplayStore())

    for path, body in [("pause", None), ("resume", None), ("speed", {"speed": 10})]:
        assert (await client.post(f"/api/v1/replay/{path}", json=body)).status_code == 409, path


async def test_an_unknown_speed_is_refused(client: httpx.AsyncClient) -> None:
    use(MemoryReplayStore(ReplayState(T0, REAL, 1, False)))

    assert (await client.post("/api/v1/replay/speed", json={"speed": 7})).status_code == 422


async def test_a_finished_replay_is_reported_as_paused(client: httpx.AsyncClient) -> None:
    store = MemoryReplayStore(ReplayState(END, REAL, 60, False), BOUNDS)
    use(store)

    body = (await client.get("/api/v1/replay")).json()

    assert body["finished"] is True and body["paused"] is True
