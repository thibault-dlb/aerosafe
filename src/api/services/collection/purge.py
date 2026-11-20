from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import Delete, Update, delete, select, true, update

from core.data_mode import DataMode
from core.logger import get_logger
from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from services.collection.sessions import SessionFactory, database_session

logger = get_logger()

# Rows deleted per transaction: short transactions, so the collections never wait long.
BATCH_SIZE = 20_000


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class PurgeReport:
    """What one purge removed."""

    observations: int = 0
    flights: int = 0


class ObservationPurger:
    """Deletes the observations of a source older than its retention: the adsb.fi ones after
    7 days, about 3.8 GB a day otherwise (D-23).

    It is the one physical DELETE of the application, on purpose (docs/data-model.md): a soft
    delete would keep the rows, and their disk. Only the observations of the source are
    touched; the aircraft stay, with their registration and model, and so do the alerts, which
    never point to an observation. The flights whose observations are all gone are soft
    deleted, so that no empty flight is listed.
    """

    def __init__(
        self,
        retention: timedelta,
        mode: DataMode = DataMode.ADSBFI,
        batch_size: int = BATCH_SIZE,
        session_factory: SessionFactory = database_session,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        if retention <= timedelta(0):
            raise ValueError("The retention must be positive")
        if not mode.is_live:
            raise ValueError("Only a live source is purged; the replay is the dataset itself")
        self._retention = retention
        self._mode = mode
        self._batch_size = batch_size
        self._session_factory = session_factory
        self._clock = clock

    def delete_statement(self, cutoff: datetime) -> Delete:
        """One batch of observations of the source last heard before `cutoff`.

        The source must be read aircraft by aircraft: every point of the replay (2022) is older
        than the cutoff too, so a scan of the index on the contact time would walk through
        hundreds of millions of them. The LATERAL subquery reads, for each aircraft of the
        source, the range of the unique index (ID_AERONEF, DT_DERNIER_CONTACT) before the
        cutoff, and nothing else.
        """
        old = (
            select(Observation.id)
            .where(Observation.aircraft_id == Aircraft.id, Observation.last_contact_at < cutoff)
            .lateral("old")
        )
        batch = (
            select(old.c.id)
            .select_from(Aircraft)
            .join(old, true())
            .where(self._mode.matches(Aircraft.source_id))
            .limit(self._batch_size)
        )
        return delete(Observation).where(Observation.id.in_(batch))

    def flights_statement(self, cutoff: datetime, now: datetime) -> Update:
        """The flights of the source that ended before `cutoff`: all their observations are
        older, so all are deleted. They are soft deleted."""
        of_source = (
            select(Aircraft.id)
            .where(Aircraft.id == Flight.aircraft_id, self._mode.matches(Aircraft.source_id))
            .correlate(Flight)
            .exists()
        )
        return (
            update(Flight)
            .where(Flight.ended_at < cutoff, Flight.deleted_at.is_(None), of_source)
            .values(deleted_at=now)
            .execution_options(synchronize_session=False)
        )

    async def run(self) -> PurgeReport:
        now = self._clock()
        cutoff = now - self._retention
        observations = 0
        while True:
            async with self._session_factory() as session:
                result = await session.execute(self.delete_statement(cutoff))
                await session.commit()
            deleted = result.rowcount or 0
            observations += deleted
            if deleted < self._batch_size:
                break
        async with self._session_factory() as session:
            result = await session.execute(self.flights_statement(cutoff, now))
            await session.commit()
        report = PurgeReport(observations, result.rowcount or 0)
        logger.info(
            "{} purge before {}: {} observation(s) deleted, {} flight(s) emptied",
            self._mode.label,
            cutoff.isoformat(),
            report.observations,
            report.flights,
        )
        return report
