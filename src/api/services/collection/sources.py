from dataclasses import dataclass
from typing import Protocol

from core.data_mode import DataMode
from services.collection.adsbfi_client import AdsbFiClient
from services.collection.adsbfi_normalizer import AdsbFiNormalizer
from services.collection.normalizer import NormalizationResult, StateVectorNormalizer
from services.collection.opensky_client import OpenSkyClient
from services.collection.profiles import BoundingBox, Circle, CoverageArea


@dataclass(frozen=True)
class SourceResponse:
    """One answer of a live source, already cleaned.

    `received` counts the raw states of the answer, `states` the ones kept by the normaliser
    and `remaining_credits` what OpenSky says is left (None for a source without credits).
    """

    states: NormalizationResult
    received: int
    remaining_credits: int | None = None


class LiveSource(Protocol):
    """A live source of aircraft states: OpenSky or adsb.fi.

    `fetch` raises `SourceUnavailable` or `SourceRateLimited`; the collection cycle turns them
    into a status.
    """

    @property
    def mode(self) -> DataMode: ...

    async def fetch(self, area: CoverageArea) -> SourceResponse: ...


class OpenSkySource:
    """OpenSky as a live source: the REST client, then the state vector normaliser."""

    def __init__(
        self, client: OpenSkyClient, normalizer: StateVectorNormalizer | None = None
    ) -> None:
        self._client = client
        self._normalizer = normalizer or StateVectorNormalizer()

    @property
    def mode(self) -> DataMode:
        return DataMode.OPENSKY

    async def fetch(self, area: CoverageArea) -> SourceResponse:
        if not isinstance(area, BoundingBox):
            raise TypeError("OpenSky reads a bounding box")
        response = await self._client.fetch_states(area)
        return SourceResponse(
            states=self._normalizer.normalize(response.states),
            received=len(response.states),
            remaining_credits=response.remaining_credits,
        )


class AdsbFiSource:
    """adsb.fi as a live source: the open data client, then its own normaliser.

    The normaliser remembers the message counters of the previous answer, so the source keeps
    one for its whole life: an aircraft that sent nothing new is not stored again.
    """

    def __init__(self, client: AdsbFiClient, normalizer: AdsbFiNormalizer | None = None) -> None:
        self._client = client
        self._normalizer = normalizer or AdsbFiNormalizer()

    @property
    def mode(self) -> DataMode:
        return DataMode.ADSBFI

    async def fetch(self, area: CoverageArea) -> SourceResponse:
        if not isinstance(area, Circle):
            raise TypeError("adsb.fi reads a circle")
        response = await self._client.fetch_aircraft(area)
        return SourceResponse(
            states=self._normalizer.normalize(response.aircraft, response.now),
            received=len(response.aircraft),
        )
