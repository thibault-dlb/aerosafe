import httpx
import pytest
from fastapi import FastAPI

from middlewares.requests import RequestLoggingMiddleware


async def test_unhandled_error_is_logged_and_raised() -> None:
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("boom")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        with pytest.raises(RuntimeError):
            await client.get("/boom")
