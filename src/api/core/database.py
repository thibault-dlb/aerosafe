from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.database import DatabaseSettings
from config.database import settings as db_settings
from core.logger import get_logger
from core.models import Base

__all__ = ["Base", "Database", "database", "get_db"]

logger = get_logger()


class Database:
    """Owns the asynchronous engine and hands out sessions."""

    def __init__(self, settings: DatabaseSettings) -> None:
        self._engine: AsyncEngine = create_async_engine(
            settings.DATABASE_ASYNC_URL,
            pool_size=settings.DB_POOL_SIZE,
            pool_recycle=settings.DB_POOL_TTL,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
        )
        self._session_factory = async_sessionmaker(
            self._engine, class_=AsyncSession, expire_on_commit=False
        )

    @property
    def engine(self) -> AsyncEngine:
        return self._engine

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        async with self._session_factory() as session:
            yield session

    async def close(self) -> None:
        logger.info("Closing database connections")
        await self._engine.dispose()


database = Database(db_settings)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency giving one session per request."""
    async for session in database.get_session():
        yield session
