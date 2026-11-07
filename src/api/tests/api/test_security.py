from collections.abc import AsyncGenerator
from typing import Annotated

import httpx
import pytest
from fastapi import Depends, FastAPI

from core.models import new_ulid
from core.security import CurrentUser, RoleCode, get_current_user, require_role


def build_app() -> FastAPI:
    application = FastAPI()

    @application.get("/supervision")
    async def supervision(
        user: Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))],
    ) -> dict[str, int]:
        return {"id": user.id}

    return application


@pytest.fixture
async def application() -> AsyncGenerator[FastAPI, None]:
    yield build_app()


async def call(application: FastAPI) -> httpx.Response:
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/supervision")


async def test_a_request_is_refused_until_authentication_exists(application: FastAPI) -> None:
    response = await call(application)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_the_wrong_role_gets_403(application: FastAPI) -> None:
    application.dependency_overrides[get_current_user] = lambda: CurrentUser(
        1, new_ulid(), RoleCode.USER
    )

    assert (await call(application)).status_code == 403


async def test_the_right_role_goes_through(application: FastAPI) -> None:
    application.dependency_overrides[get_current_user] = lambda: CurrentUser(
        7, new_ulid(), RoleCode.SUPERVISOR
    )

    response = await call(application)

    assert response.status_code == 200
    assert response.json() == {"id": 7}
