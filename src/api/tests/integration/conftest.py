"""Fixtures of the integration tests, which need a migrated PostgreSQL database.

Each test runs as the application user inside a transaction that is rolled back at the end,
so the tests leave no data behind and can run in parallel.
"""

from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from config.database import settings


@pytest.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(settings.DATABASE_ASYNC_URL, poolclass=NullPool)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        database_session = AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield database_session
        finally:
            await database_session.close()
            await transaction.rollback()
    await engine.dispose()
