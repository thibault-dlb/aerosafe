from datetime import datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from models import Aircraft, Observation
from services.rules.base import AircraftSnapshot, StateSample

# An aircraft silent for longer probably left the coverage zone: it is no longer evaluated,
# so it does not raise R1 and R2 alerts forever.
SILENCE_LIMIT = timedelta(minutes=30)


def to_float(value: object) -> float | None:
    return None if value is None else float(value)


class SnapshotReader:
    """Reads, for each recently heard aircraft, the observations the rules need."""

    def __init__(self, session: AsyncSession, silence_limit: timedelta = SILENCE_LIMIT) -> None:
        self._session = session
        self._silence_limit = silence_limit

    def recent_query(self, now: datetime) -> Select:
        """The latest observation of each aircraft heard in the window, and the one before it
        in each of its flights.

        The window bounds the scan: an older previous observation would be more than 300 s
        away, so R3 to R5 would ignore the pair anyway.
        """
        ranked = (
            select(
                Observation.aircraft_id,
                Aircraft.icao24,
                Observation.flight_id,
                Observation.last_contact_at,
                Observation.position_at,
                Observation.altitude,
                Observation.speed,
                Observation.heading,
                Observation.on_ground,
                func.row_number()
                .over(
                    partition_by=Observation.aircraft_id,
                    order_by=Observation.last_contact_at.desc(),
                )
                .label("aircraft_rank"),
                func.row_number()
                .over(
                    partition_by=(Observation.aircraft_id, Observation.flight_id),
                    order_by=Observation.last_contact_at.desc(),
                )
                .label("flight_rank"),
            )
            .join(Aircraft, Aircraft.id == Observation.aircraft_id)
            .where(
                Observation.deleted_at.is_(None),
                Aircraft.deleted_at.is_(None),
                Observation.last_contact_at > now - self._silence_limit,
                Observation.last_contact_at <= now,
            )
            .subquery("ranked")
        )
        return (
            select(ranked)
            .where((ranked.c.aircraft_rank == 1) | (ranked.c.flight_rank == 2))
            .order_by(ranked.c.aircraft_id, ranked.c.aircraft_rank)
        )

    @staticmethod
    def positioned_query(aircraft_ids: list[int], now: datetime) -> Select:
        """The latest observation with a position of each given aircraft, for R2."""
        return (
            select(
                Observation.aircraft_id,
                Observation.flight_id,
                Observation.last_contact_at,
                Observation.position_at,
                Observation.altitude,
                Observation.speed,
                Observation.heading,
                Observation.on_ground,
            )
            .ext(distinct_on(Observation.aircraft_id))
            .where(
                Observation.deleted_at.is_(None),
                Observation.aircraft_id.in_(aircraft_ids),
                Observation.position_at.is_not(None),
                Observation.last_contact_at <= now,
            )
            .order_by(Observation.aircraft_id, Observation.last_contact_at.desc())
        )

    async def read(self, now: datetime) -> list[AircraftSnapshot]:
        """One snapshot per aircraft heard less than the silence limit before `now`."""
        rows = (await self._session.execute(self.recent_query(now))).all()
        latest: dict[int, Row] = {}
        icao24: dict[int, str] = {}
        others: dict[int, list[Row]] = {}
        for row in rows:
            if row.aircraft_rank == 1:
                latest[row.aircraft_id] = row
                icao24[row.aircraft_id] = row.icao24
            else:
                others.setdefault(row.aircraft_id, []).append(row)
        if not latest:
            return []

        positioned_rows = await self._session.execute(self.positioned_query(list(latest), now))
        positioned = {row.aircraft_id: self.to_sample(row) for row in positioned_rows.all()}

        snapshots = []
        for aircraft_id, row in latest.items():
            previous = next(
                (
                    other
                    for other in others.get(aircraft_id, [])
                    if row.flight_id is not None and other.flight_id == row.flight_id
                ),
                None,
            )
            snapshots.append(
                AircraftSnapshot(
                    aircraft_id=aircraft_id,
                    icao24=icao24[aircraft_id],
                    latest=self.to_sample(row),
                    previous=None if previous is None else self.to_sample(previous),
                    latest_with_position=positioned.get(aircraft_id),
                )
            )
        return snapshots

    @staticmethod
    def to_sample(row: Row) -> StateSample:
        return StateSample(
            last_contact_at=row.last_contact_at,
            position_at=row.position_at,
            altitude=to_float(row.altitude),
            speed=to_float(row.speed),
            heading=to_float(row.heading),
            on_ground=row.on_ground,
            flight_id=row.flight_id,
        )
