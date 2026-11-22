import httpx

from config.adsbfi import AdsbFiSettings
from config.opensky import OpenSkySettings
from core.data_mode import DataMode
from services.collection.adsbfi_client import AdsbFiClient
from services.collection.opensky_client import OpenSkyClient, TokenProvider

LiveClient = OpenSkyClient | AdsbFiClient


def build_live_client(
    mode: DataMode, opensky: OpenSkySettings, adsbfi: AdsbFiSettings
) -> tuple[LiveClient, httpx.AsyncClient]:
    """The client of a live source, with the HTTP connection it reads through.

    The caller owns the connection and closes it. The collection and the live preview of the
    dashboard both build their clients here, so they reach a source the same way.
    """
    if mode is DataMode.ADSBFI:
        http = httpx.AsyncClient(timeout=adsbfi.ADSBFI_TIMEOUT_SECONDS)
        return AdsbFiClient(http, adsbfi.ADSBFI_API_URL), http
    if mode is not DataMode.OPENSKY:
        raise ValueError(f"{mode.label} is not a live source")
    http = httpx.AsyncClient(timeout=opensky.OPENSKY_TIMEOUT_SECONDS)
    token_provider = None
    if opensky.has_credentials:
        token_provider = TokenProvider(
            http,
            opensky.OPENSKY_TOKEN_URL,
            opensky.OPENSKY_CLIENT_ID,
            opensky.OPENSKY_CLIENT_SECRET.get_secret_value(),
        )
    return OpenSkyClient(http, opensky.OPENSKY_API_URL, token_provider), http
