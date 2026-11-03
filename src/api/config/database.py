from config.base import CustomBaseSettings


class DatabaseSettings(CustomBaseSettings):
    DB_HOST: str = "127.0.0.1"
    DB_USER: str = "postgres"
    DB_PASS: str = ""
    DB_NAME: str = "aerosafe_db"
    DB_PORT: int = 5432

    DB_POOL_SIZE: int = 16
    DB_POOL_TTL: int = 60 * 20  # 20 minutes
    DB_POOL_PRE_PING: bool = True

    @property
    def DATABASE_ASYNC_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = DatabaseSettings()
