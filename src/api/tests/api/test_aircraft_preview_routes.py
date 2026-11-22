from collections.abc import AsyncGenerator

import httpx
import pytest

from core.data_mode import DataMode
from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.aircraft import get_live_preview
from schemas.aircraft import AircraftSummary
from services.preview import PreviewUnavailable

PLANE = AircraftSummary(id="3c6444", icao24="3c6444", latitude=48.8, longitude=2.3)


class FakePreview:
    def __init__(self, outcome: list[AircraftSummary] | Exception) -> None:
        self.outcome = outcome
        self.modes: list[DataMode] = []

    async def aircraft(self, mode: DataMode) -> list[AircraftSummary]:
        self.modes.append(mode)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


@pytest.fixture
async def api() -> AsyncGenerator[httpx.AsyncClient, None]:
    async def user() -> CurrentUser:
        return CurrentUser(id=1, public_id="01JC0000000000000000000001", role=RoleCode.USER)

    app.dependency_overrides[get_current_user] = user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


def use(preview: FakePreview) -> None:
    app.dependency_overrides[get_live_preview] = lambda: preview


async def test_the_preview_gives_the_aircraft_of_the_source(api: httpx.AsyncClient) -> None:
    preview = FakePreview([PLANE])
    use(preview)

    response = await api.get("/api/v1/aircraft/preview", params={"source": "opensky"})

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["3c6444"]
    assert preview.modes == [DataMode.OPENSKY]


async def test_the_preview_reads_adsbfi_by_default(api: httpx.AsyncClient) -> None:
    preview = FakePreview([])
    use(preview)

    response = await api.get("/api/v1/aircraft/preview")

    assert response.json() == []
    assert preview.modes == [DataMode.ADSBFI]


async def test_the_replay_has_no_preview(api: httpx.AsyncClient) -> None:
    use(FakePreview([]))

    response = await api.get("/api/v1/aircraft/preview", params={"source": "replay"})

    assert response.status_code == 422


async def test_a_source_that_cannot_be_read_answers_503_with_the_delay(
    api: httpx.AsyncClient,
) -> None:
    use(FakePreview(PreviewUnavailable("refused", 30)))

    response = await api.get("/api/v1/aircraft/preview")

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "30"


async def test_a_source_that_is_down_answers_503_without_a_delay(api: httpx.AsyncClient) -> None:
    use(FakePreview(PreviewUnavailable("down")))

    response = await api.get("/api/v1/aircraft/preview")

    assert response.status_code == 503
    assert "Retry-After" not in response.headers
