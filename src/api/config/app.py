from config.base import CustomBaseSettings


class AppSettings(CustomBaseSettings):
    APP_NAME: str = "AeroSafe"
    APP_VERSION: str = "0.1.0"

    @property
    def fastapi_kwargs(self) -> dict[str, str]:
        return {"title": self.APP_NAME, "version": self.APP_VERSION}


settings = AppSettings()
