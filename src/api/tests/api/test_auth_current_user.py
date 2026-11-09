from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Annotated

import httpx
import pytest
from fastapi import Depends, FastAPI

from config.auth import settings as auth_settings
from core.security import CurrentUser, RoleCode, get_current_user, require_role
from services.auth.store import get_user_store
from services.auth.tokens import AccessClaims, AccessTokenCodec
from tests.auth_support import SECRET, SETTINGS, FakeUserStore


@pytest.fixture
def store() -> FakeUserStore:
    return FakeUserStore()


@pytest.fixture
async def client(
    store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[httpx.AsyncClient, None]:
    monkeypatch.setattr(auth_settings, "AUTH_JWT_SECRET", SECRET)
    application = FastAPI()

    @application.get("/me")
    async def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> dict:
        return {"id": user.id, "public_id": user.public_id, "role": user.role}

    @application.get("/supervision")
    async def supervision(
        _user: Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))],
    ) -> None:
        return None

    application.dependency_overrides[get_user_store] = lambda: store
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


def bearer(public_id: str, role: str = RoleCode.USER, now: datetime | None = None) -> dict:
    token = AccessTokenCodec(SETTINGS).encode(
        AccessClaims(public_id, role), now or datetime.now(UTC)
    )
    return {"Authorization": f"Bearer {token}"}


async def test_a_valid_token_gives_the_caller(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    user = await store.seed("pilot@example.com")

    response = await client.get("/me", headers=bearer(user.public_id))

    assert response.status_code == 200
    assert response.json() == {"id": user.id, "public_id": user.public_id, "role": "USER"}


async def test_the_role_comes_from_the_database_not_the_token(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    user = await store.seed("pilot@example.com")

    response = await client.get("/supervision", headers=bearer(user.public_id, "SUPERVISOR"))

    assert response.status_code == 403


async def test_a_supervisor_reaches_supervision(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    user = await store.seed("chief@example.com", RoleCode.SUPERVISOR)

    assert (await client.get("/supervision", headers=bearer(user.public_id))).status_code == 200


async def test_requests_without_a_valid_token_get_401(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    user = await store.seed("pilot@example.com")
    expired = bearer(user.public_id, now=datetime.now(UTC) - timedelta(hours=1))

    for headers in ({}, {"Authorization": "Bearer nonsense"}, expired, bearer("unknown")):
        response = await client.get("/me", headers=headers)
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_a_deactivated_account_loses_access_at_once(
    client: httpx.AsyncClient, store: FakeUserStore
) -> None:
    user = await store.seed("pilot@example.com")
    headers = bearer(user.public_id)
    user.is_active = False

    assert (await client.get("/me", headers=headers)).status_code == 401
