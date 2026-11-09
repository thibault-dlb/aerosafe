from config.base import CustomBaseSettings


class DatabaseSettings(CustomBaseSettings):
    DB_HOST: str = "127.0.0.1"
    DB_USER: str = "aerosafe_user"
    DB_PASS: str = ""
    DB_NAME: str = "aerosafe_db"
    DB_PORT: int = 5432

    DB_MIGRATION_USER: str = "aerosafe_migrator"
    DB_MIGRATION_PASS: str = ""

    DB_POOL_SIZE: int = 16
    DB_POOL_TTL: int = 60 * 20  # 20 minutes
    DB_POOL_PRE_PING: bool = True

    def _async_url(self, user: str, password: str) -> str:
        return (
            f"postgresql+asyncpg://{user}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def DATABASE_ASYNC_URL(self) -> str:
        return self._async_url(self.DB_USER, self.DB_PASS)

    @property
    def DATABASE_MIGRATION_ASYNC_URL(self) -> str:
        return self._async_url(self.DB_MIGRATION_USER, self.DB_MIGRATION_PASS)


settings = DatabaseSettings()
