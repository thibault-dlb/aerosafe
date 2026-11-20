from datetime import UTC, datetime, timedelta

import pytest

from core.data_mode import DataMode
from services.collection.errors import SourceError, SourceRateLimited, SourceUnavailable
from services.collection.opensky_client import (
    OpenSkyError,
    OpenSkyRateLimited,
    OpenSkyUnavailable,
    StatesResponse,
)
from services.collection.profiles import BoundingBox, Circle
from services.collection.run_state import (
    CollectionRunResult,
    InMemoryCollectionStateStore,
    PauseState,
    RunStatus,
)
from services.collection.sources import OpenSkySource

NOW = datetime(2026, 11, 20, 12, tzinfo=UTC)
BOX = BoundingBox(48.0, 49.3, 1.4, 3.6)
VALID = ["3c6444", "DLH9LF", "Germany", 1_700_000_000, 1_700_000_000]


class FakeClient:
    def __init__(self, response: StatesResponse) -> None:
        self.response = response
        self.boxes: list[BoundingBox] = []

    async def fetch_states(self, box: BoundingBox) -> StatesResponse:
        self.boxes.append(box)
        return self.response


def test_the_opensky_errors_are_source_errors() -> None:
    limited = OpenSkyRateLimited(retry_after_seconds=60)

    assert isinstance(limited, SourceRateLimited)
    assert isinstance(limited, OpenSkyError)
    assert limited.retry_after_seconds == 60
    assert "retry after 60 s" in str(limited)
    assert issubclass(OpenSkyUnavailable, SourceUnavailable)
    assert issubclass(SourceUnavailable, SourceError)


async def test_opensky_reads_its_box_and_cleans_the_states() -> None:
    client = FakeClient(StatesResponse(time=1, states=[VALID, ["bad"]], remaining_credits=12))
    source = OpenSkySource(client)  # type: ignore[arg-type]

    response = await source.fetch(BOX)

    assert source.mode is DataMode.OPENSKY
    assert client.boxes == [BOX]
    assert (response.received, response.remaining_credits) == (2, 12)
    assert [state.icao24 for state in response.states.states] == ["3c6444"]
    assert response.states.rejected == 1


async def test_opensky_refuses_a_circle() -> None:
    source = OpenSkySource(FakeClient(StatesResponse(time=1)))  # type: ignore[arg-type]

    with pytest.raises(TypeError):
        await source.fetch(Circle(48.65, 2.5, 250))


def run(source: DataMode, seconds: int = 0, status: str = RunStatus.SUCCESS) -> CollectionRunResult:
    started = NOW + timedelta(seconds=seconds)
    return CollectionRunResult(started, started, status, "X", source=source)


async def test_the_memory_store_keeps_the_runs_of_each_source_apart() -> None:
    store = InMemoryCollectionStateStore()
    opensky, adsbfi, failed = (
        run(DataMode.OPENSKY),
        run(DataMode.ADSBFI, 5),
        run(DataMode.ADSBFI, 10, RunStatus.FAILED),
    )
    for item in (opensky, adsbfi, failed):
        await store.record(item)

    assert await store.runs(10) == [opensky]
    assert await store.runs(10, source=DataMode.ADSBFI) == [failed, adsbfi]
    assert await store.last_success(DataMode.ADSBFI) == adsbfi
    assert await store.last_success(DataMode.OPENSKY) == opensky


async def test_the_memory_store_keeps_a_pause_for_each_source() -> None:
    store = InMemoryCollectionStateStore()

    await store.set_paused(True, NOW, 7, DataMode.ADSBFI)

    assert await store.pause_state(DataMode.ADSBFI) == PauseState(True, NOW, 7)
    assert await store.pause_state() == PauseState()
