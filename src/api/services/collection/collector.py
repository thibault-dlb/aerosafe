from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from services.collection.flight_grouper import FlightGrouper
from services.collection.normalizer import StateVectorNormalizer
from services.collection.opensky_client import OpenSkyClient
from services.collection.profiles import CollectionProfile
from services.collection.run_state import CollectionRunResult, RunStatus
from services.collection.store import ObservationStore

StoreFactory = Callable[[AsyncSession, FlightGrouper], ObservationStore]


def utc_now() -> datetime:
    return datetime.now(UTC)


class DataCollector:
    """One collection (UC-08): read OpenSky, clean, store, close finished flights.

    OpenSky errors propagate as `OpenSkyError`; the collection cycle turns them into a status.
    """

    def __init__(
        self,
        client: OpenSkyClient,
        profile: CollectionProfile,
        grouper: FlightGrouper,
        normalizer: StateVectorNormalizer | None = None,
        store_factory: StoreFactory = ObservationStore,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._client = client
        self._profile = profile
        self._grouper = grouper
        self._normalizer = normalizer or StateVectorNormalizer()
        self._store_factory = store_factory
        self._clock = clock

    @property
    def profile(self) -> CollectionProfile:
        return self._profile

    @property
    def authenticated(self) -> bool:
        return self._client.authenticated

    async def run(self, session: AsyncSession, started_at: datetime) -> CollectionRunResult:
        response = await self._client.fetch_states(self._profile.bounding_box)
        normalized = self._normalizer.normalize(response.states)

        store = self._store_factory(session, self._grouper)
        stored = await store.save(normalized.states)
        await store.close_stale_flights(started_at)
        await session.commit()

        return CollectionRunResult(
            started_at=started_at,
            ended_at=self._clock(),
            status=RunStatus.PARTIAL if normalized.rejected else RunStatus.SUCCESS,
            profile=self._profile.code,
            received=len(response.states),
            stored=stored,
            rejected=normalized.rejected,
            remaining_credits=response.remaining_credits,
        )
