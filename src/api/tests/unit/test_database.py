from sqlalchemy.ext.asyncio import AsyncSession

from config.database import DatabaseSettings
from core.database import Database


def test_database_url_is_built_from_settings() -> None:
    settings = DatabaseSettings(DB_HOST="db", DB_USER="u", DB_PASS="p", DB_NAME="n", DB_PORT=5433)

    assert settings.DATABASE_ASYNC_URL == "postgresql+asyncpg://u:p@db:5433/n"


def test_migration_url_uses_the_migration_user() -> None:
    settings = DatabaseSettings(
        DB_HOST="db",
        DB_USER="u",
        DB_PASS="p",
        DB_NAME="n",
        DB_PORT=5433,
        DB_MIGRATION_USER="m",
        DB_MIGRATION_PASS="s",
    )

    assert settings.DATABASE_MIGRATION_ASYNC_URL == "postgresql+asyncpg://m:s@db:5433/n"


async def test_database_yields_a_session_and_closes() -> None:
    database = Database(DatabaseSettings())

    async for session in database.get_session():
        assert isinstance(session, AsyncSession)

    await database.close()
