import pytest

from config.adsbfi import AdsbFiSettings
from config.opensky import OpenSkySettings
from core.data_mode import DataMode
from services.collection.adsbfi_client import AdsbFiClient
from services.collection.clients import build_live_client
from services.collection.opensky_client import OpenSkyClient

ADSBFI = AdsbFiSettings(_env_file=None)


async def test_adsbfi_is_read_through_its_open_data_client() -> None:
    client, http = build_live_client(DataMode.ADSBFI, OpenSkySettings(_env_file=None), ADSBFI)
    try:
        assert isinstance(client, AdsbFiClient)
        assert http.timeout.read == ADSBFI.ADSBFI_TIMEOUT_SECONDS
    finally:
        await http.aclose()


async def test_opensky_is_anonymous_without_an_account() -> None:
    client, http = build_live_client(DataMode.OPENSKY, OpenSkySettings(_env_file=None), ADSBFI)
    try:
        assert isinstance(client, OpenSkyClient)
        assert not client.authenticated
    finally:
        await http.aclose()


async def test_opensky_signs_in_with_the_account_of_the_group() -> None:
    settings = OpenSkySettings(
        _env_file=None, OPENSKY_CLIENT_ID="id", OPENSKY_CLIENT_SECRET="secret"
    )

    client, http = build_live_client(DataMode.OPENSKY, settings, ADSBFI)
    try:
        assert isinstance(client, OpenSkyClient)
        assert client.authenticated
    finally:
        await http.aclose()


def test_the_replay_has_no_client() -> None:
    with pytest.raises(ValueError, match="not a live source"):
        build_live_client(DataMode.REPLAY, OpenSkySettings(_env_file=None), ADSBFI)
