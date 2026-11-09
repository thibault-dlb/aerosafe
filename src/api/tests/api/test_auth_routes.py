from collections.abc import AsyncGenerator
from datetime import timedelta

import httpx
import jwt
import pytest

from config.auth import settings as auth_settings
from core.security import RoleCode
from main import app
from services.auth import service as service_module
from services.auth.service import get_auth_service
from services.auth.store import get_user_store
from services.auth.throttle import LoginThrottle
from tests.auth_support import PASSWORD, SECRET, FakeUserStore, build_service

COOKIE_PATH = "/api/v1/auth"


@pytest.fixture
def store() -> FakeUserStore:
    return FakeUserStore()


@pytest.fixture
async def client(
    store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[httpx.AsyncClient, None]:
    monkeypatch.setattr(auth_settings, "AUTH_JWT_SECRET", SECRET)
    app.dependency_overrides[get_user_store] = lambda: store
    app.dependency_overrides[get_auth_service] = lambda: build_service(store)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


async def login(client: httpx.AsyncClient, password: str = PASSWORD) -> httpx.Response:
    return await client.post(
        "/api/v1/auth/login", json={"email": "Pilot@Example.com", "password": password}
    )


async def test_sign_up_returns_the_public_account(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/signup", json={"email": "Pilot@Example.com", "password": PASSWORD}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "pilot@example.com"
    assert body["role"] == RoleCode.USER
    assert len(body["id"]) == 26
    assert "password_hash" not in body


async def test_sign_up_with_a_taken_email_gets_409(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    await store.seed("pilot@example.com")

    response = await client.post(
        "/api/v1/auth/signup", json={"email": "pilot@example.com", "password": PASSWORD}
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "pilot@example.com", "password": "too short"},
        {"email": "pilot@example.com", "password": "x" * 129},
    ],
)
async def test_sign_up_validates_the_input(client: httpx.AsyncClient, body: dict) -> None:
    assert (await client.post("/api/v1/auth/signup", json=body)).status_code == 422


async def test_login_sets_a_strict_http_only_cookie(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    await store.seed("pilot@example.com")

    response = await login(client)

    assert response.status_code == 200
    assert response.json()["expires_in"] == 15 * 60
    assert response.json()["user"]["email"] == "pilot@example.com"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert f"path={COOKIE_PATH}" in cookie
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"


async def test_a_wrong_password_gets_401(client: httpx.AsyncClient, store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")

    response = await login(client, "wrong password!")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


async def test_repeated_failures_get_429(client: httpx.AsyncClient, store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")
    throttle = LoginThrottle(1, timedelta(minutes=15))
    app.dependency_overrides[get_auth_service] = lambda: service_module.AuthService(
        store, build_service(store)._codec, throttle, timedelta(days=7)
    )

    await login(client, "wrong password!")

    assert (await login(client)).status_code == 429


async def test_the_access_token_carries_the_public_id_and_role(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    user = await store.seed("pilot@example.com")
    token = (await login(client)).json()["access_token"]

    claims = jwt.decode(token, SECRET, algorithms=["HS256"])
    assert claims["sub"] == user.public_id
    assert claims["role"] == RoleCode.USER


async def test_refresh_rotates_the_cookie_and_logout_ends_the_session(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    await store.seed("pilot@example.com")
    first = (await login(client)).cookies["refresh_token"]

    async def post_with_cookie(path: str, token: str) -> httpx.Response:
        client.cookies.clear()
        client.cookies.set("refresh_token", token)
        return await client.post(path)

    refreshed = await post_with_cookie("/api/v1/auth/refresh", first)
    assert refreshed.status_code == 200
    second = refreshed.cookies["refresh_token"]
    assert refreshed.headers["cache-control"] == "no-store"
    assert second != first

    replay = await post_with_cookie("/api/v1/auth/refresh", first)
    assert replay.status_code == 401
    assert 'refresh_token=""' in replay.headers["set-cookie"]

    assert (await post_with_cookie("/api/v1/auth/logout", second)).status_code == 204
    assert (await post_with_cookie("/api/v1/auth/refresh", second)).status_code == 401


async def test_refresh_and_logout_without_a_cookie(client: httpx.AsyncClient) -> None:
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
    assert (await client.post("/api/v1/auth/logout")).status_code == 204


def test_the_default_dependency_builds_a_service(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_settings, "AUTH_JWT_SECRET", SECRET)

    assert isinstance(get_auth_service(FakeUserStore()), service_module.AuthService)
