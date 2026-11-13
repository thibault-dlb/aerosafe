from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config.app import settings as app_settings
from config.auth import settings as auth_settings
from core.database import database
from middlewares.requests import RequestLoggingMiddleware
from routes.router import api_router, health_router
from services.auth.tokens import AccessTokenCodec
from services.collection.scheduler import Scheduler
from services.replay.scheduler import ReplayScheduler


@asynccontextmanager
async def lifespan(_application: FastAPI) -> AsyncGenerator[None, None]:
    # A missing or weak JWT secret stops the start, instead of a 500 on every protected route.
    AccessTokenCodec.check_secret(auth_settings.AUTH_JWT_SECRET)
    scheduler = Scheduler()
    await scheduler.start()
    replay_scheduler = ReplayScheduler()
    await replay_scheduler.start()
    yield
    await replay_scheduler.stop()
    await scheduler.stop()
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
