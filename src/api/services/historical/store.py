from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import (
    BigInteger,
    ColumnElement,
    Text,
    any_,
    func,
    literal,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import TypeEngine

from core.data_mode import DataMode
from core.models import new_ulid
from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from models.reference import DataSource
from services.historical.prc2024 import ObservationBatch

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
_MICROSECOND = timedelta(microseconds=1)

# Identifiers are uppercase and quoted, as in every raw query of the project, and every value
# is a bound parameter. The arrays are unnested into rows, so a batch of 50 000 observations is
# one statement. The unique pair (aircraft, last contact) makes a second run of a file a no-op.
_INSERT_OBSERVATIONS = text(
    """
    INSERT INTO "OBSERVATION" (
        "ID_AERONEF", "ID_VOL", "DT_DERNIER_CONTACT", "DT_POSITION", "GEO_POSITION",
        "NB_ALTITUDE", "NB_VITESSE", "NB_CAP", "BL_AU_SOL"
    )
    SELECT t.aircraft_id,
           t.flight_id,
           TIMESTAMPTZ 'epoch' + t.observed_us * INTERVAL '1 microsecond',
           TIMESTAMPTZ 'epoch' + t.observed_us * INTERVAL '1 microsecond',
           ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326),
           CAST(t.altitude AS NUMERIC(7, 1)),
           CAST(t.speed AS NUMERIC(6, 2)),
           CAST(t.heading AS NUMERIC(5, 2)),
           t.on_ground
    FROM unnest(
        CAST(:aircraft_ids AS BIGINT[]),
        CAST(:flight_ids AS BIGINT[]),
        CAST(:observed_us AS BIGINT[]),
        CAST(:longitudes AS DOUBLE PRECISION[]),
        CAST(:latitudes AS DOUBLE PRECISION[]),
        CAST(:altitudes AS DOUBLE PRECISION[]),
        CAST(:speeds AS DOUBLE PRECISION[]),
        CAST(:headings AS DOUBLE PRECISION[]),
        CAST(:on_grounds AS BOOLEAN[])
    ) AS t(aircraft_id, flight_id, observed_us, longitude, latitude, altitude, speed, heading,
           on_ground)
    ON CONFLICT ("ID_AERONEF", "DT_DERNIER_CONTACT") DO NOTHING
    """
)


def _any_of(values: Sequence[Any], item_type: TypeEngine[Any]) -> ColumnElement[Any]:
    """`= ANY(:values)` with one array parameter, instead of one parameter per value."""
    return any_(literal(list(values), ARRAY(item_type)))


def to_microseconds(moment: datetime) -> int:
    return (moment - _EPOCH) // _MICROSECOND


def from_microseconds(microseconds: int) -> datetime:
    return _EPOCH + microseconds * _MICROSECOND


@dataclass(frozen=True)
class NewFlight:
    """A segment of trajectory that must become a row of `VOL`."""

    aircraft_id: int
    started_us: int
    ended_us: int


class HistoricalStore:
    """Writes the historical data into the caller's transaction.

    The caller commits: a daily file is either entirely in the database or not at all.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def ensure_aircraft(self, icao24s: Sequence[str]) -> dict[str, int]:
        """Create the replay aircraft not known yet, then map every ICAO24 code to its key.

        The aircraft take the source REJEU, so a synthetic code never meets the address of a
        real aircraft collected live: the address is unique for each source. A soft-deleted
        aircraft keeps its row, so the insert skips it and it is read back like the others.
        """
        if not icao24s:
            return {}
        source_id = await self._replay_source_id()
        await self._session.execute(
            insert(Aircraft).on_conflict_do_nothing(
                index_elements=["CD_ICAO24", "ID_SOURCE_DONNEE"]
            ),
            [
                {"icao24": icao24, "public_id": new_ulid(), "source_id": source_id}
                for icao24 in icao24s
            ],
        )
        # Only the aircraft of the replay: a real aircraft collected live can have the same code.
        rows = await self._session.execute(
            select(Aircraft.icao24, Aircraft.id).where(
                Aircraft.icao24 == _any_of(icao24s, Text()),
                Aircraft.source_id == source_id,
            )
        )
        return {icao24: aircraft_id for icao24, aircraft_id in rows.all()}

    async def _replay_source_id(self) -> int:
        """The key of the source REJEU, read once for each call."""
        return int(
            await self._session.scalar(
                select(DataSource.id).where(DataSource.code == DataMode.REPLAY.code)
            )
            or 0
        )

    async def ensure_flights(self, flights: Sequence[NewFlight]) -> dict[tuple[int, int], int]:
        """Create the flights not known yet; map (aircraft key, start in µs) to the flight key.

        A flight is known when its aircraft already has one that starts at the same instant,
        which makes a second run of the same file create nothing.
        """
        if not flights:
            return {}
        aircraft_ids = sorted({flight.aircraft_id for flight in flights})
        known: dict[tuple[int, int], int] = {}
        existing = await self._session.execute(
            select(Flight.id, Flight.aircraft_id, Flight.started_at).where(
                Flight.aircraft_id == _any_of(aircraft_ids, BigInteger()),
                Flight.deleted_at.is_(None),
            )
        )
        for flight_id, aircraft_id, started_at in existing.all():
            known[(aircraft_id, to_microseconds(started_at))] = flight_id

        missing = [f for f in flights if (f.aircraft_id, f.started_us) not in known]
        if missing:
            created = await self._session.execute(
                insert(Flight).returning(Flight.id, Flight.aircraft_id, Flight.started_at),
                [
                    {
                        "aircraft_id": flight.aircraft_id,
                        "public_id": new_ulid(),
                        "started_at": from_microseconds(flight.started_us),
                        "ended_at": from_microseconds(flight.ended_us),
                    }
                    for flight in missing
                ],
            )
            for flight_id, aircraft_id, started_at in created.all():
                known[(aircraft_id, to_microseconds(started_at))] = flight_id
        return known

    async def count_observations(self, aircraft_ids: Sequence[int]) -> int:
        """Observations of these aircraft, soft-deleted ones included: they are in the table."""
        if not aircraft_ids:
            return 0
        statement = (
            select(func.count())
            .select_from(Observation)
            .where(Observation.aircraft_id == _any_of(aircraft_ids, BigInteger()))
        )
        return int(await self._session.scalar(statement) or 0)

    async def insert_observations(self, batch: ObservationBatch) -> int:
        """Store a batch and return how many rows are new."""
        result = await self._session.execute(
            _INSERT_OBSERVATIONS,
            {
                "aircraft_ids": batch.aircraft_ids,
                "flight_ids": batch.flight_ids,
                "observed_us": batch.observed_us,
                "longitudes": batch.longitudes,
                "latitudes": batch.latitudes,
                "altitudes": batch.altitudes,
                "speeds": batch.speeds,
                "headings": batch.headings,
                "on_grounds": batch.on_grounds,
            },
        )
        return int(result.rowcount or 0)


class HistoricalUnitOfWork:
    """Gives a store with its own session and transaction, committed when the block ends.

    The importer opens one for each step and for each batch, so that several batches are written
    at the same time over several connections, and a failed batch is rolled back alone.
    """

    def __init__(
        self, session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]]
    ) -> None:
        self._session_factory = session_factory

    @asynccontextmanager
    async def __call__(self) -> AsyncIterator[HistoricalStore]:
        async with self._session_factory() as session, session.begin():
            yield HistoricalStore(session)
