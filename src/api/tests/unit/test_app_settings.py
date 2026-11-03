from config.app import AppSettings


def test_fastapi_kwargs_expose_name_and_version() -> None:
    settings = AppSettings(APP_NAME="Name", APP_VERSION="1.2.3")

    assert settings.fastapi_kwargs == {"title": "Name", "version": "1.2.3"}
