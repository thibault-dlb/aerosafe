from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from core.database import database

SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


@asynccontextmanager
async def database_session() -> AsyncIterator[AsyncSession]:
    """One session outside any request, for the scheduled cycles."""
    async for session in database.get_session():
        yield session
