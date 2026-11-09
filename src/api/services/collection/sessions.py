from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, aclosing, asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from core.database import database

SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


@asynccontextmanager
async def database_session() -> AsyncIterator[AsyncSession]:
    """One session outside any request, for the scheduled cycles.

    `aclosing` closes the session at once when the caller raises, instead of leaving the
    connection out of the pool until the generator is garbage collected.
    """
    async with aclosing(database.get_session()) as sessions:
        async for session in sessions:
            yield session
