from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config.app import settings as app_settings
from core.database import database
from middlewares.requests import RequestLoggingMiddleware
from routes.router import api_router, health_router


@asynccontextmanager
async def lifespan(_application: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await database.close()


def create_app() -> FastAPI:
    application = FastAPI(
        description="AeroSafe aeronautical data monitoring API",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        **app_settings.fastapi_kwargs,
    )
    application.add_middleware(RequestLoggingMiddleware)
    application.include_router(health_router)
    application.include_router(api_router)
    return application


app = create_app()
