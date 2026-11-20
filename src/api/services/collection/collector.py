from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from services.collection.flight_grouper import FlightGrouper
from services.collection.profiles import CollectionProfile
from services.collection.run_state import CollectionRunResult, RunStatus
from services.collection.sources import LiveSource
from services.collection.store import ObservationStore

StoreFactory = Callable[[AsyncSession, FlightGrouper, DataMode], ObservationStore]


def utc_now() -> datetime:
    return datetime.now(UTC)


class DataCollector:
    """One collection (UC-08): read a live source, clean, store, close finished flights.

    Source errors propagate as `SourceError`; the collection cycle turns them into a status.
    """

    def __init__(
        self,
        source: LiveSource,
        profile: CollectionProfile,
        grouper: FlightGrouper,
        store_factory: StoreFactory = ObservationStore,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._source = source
        self._profile = profile
        self._grouper = grouper
        self._store_factory = store_factory
        self._clock = clock

    @property
    def profile(self) -> CollectionProfile:
        return self._profile

    @property
    def mode(self) -> DataMode:
        """The source this collector feeds."""
        return self._source.mode

    @property
    def source(self) -> LiveSource:
        return self._source

    async def run(self, session: AsyncSession, started_at: datetime) -> CollectionRunResult:
        response = await self._source.fetch(self._profile.area)
        normalized = response.states

        store = self._store_factory(session, self._grouper, self.mode)
        stored = await store.save(normalized.states)
        await store.close_stale_flights(started_at)
        await session.commit()

        return CollectionRunResult(
            started_at=started_at,
            ended_at=self._clock(),
            status=RunStatus.PARTIAL if normalized.rejected else RunStatus.SUCCESS,
            profile=self._profile.code,
            received=response.received,
            stored=stored,
            rejected=normalized.rejected,
            remaining_credits=response.remaining_credits,
            source=self.mode,
        )
