from config.base import CustomBaseSettings


class AuthSettings(CustomBaseSettings):
    # Empty by default so the tests import the app without secrets; tokens refuse a short key.
    AUTH_JWT_SECRET: str = ""
    AUTH_ACCESS_TOKEN_MINUTES: int = 15
    AUTH_REFRESH_TOKEN_DAYS: int = 7
    # True in production behind HTTPS; False lets the cookie work over plain HTTP in development.
    AUTH_COOKIE_SECURE: bool = False
    AUTH_LOGIN_MAX_FAILURES: int = 5
    AUTH_LOGIN_LOCK_MINUTES: int = 15


settings = AuthSettings()
