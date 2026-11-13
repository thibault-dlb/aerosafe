from datetime import datetime, timedelta

from sqlalchemy import Select, func, select, true
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from models import Aircraft, Observation
from services.rules.base import AircraftSnapshot, StateSample
from services.rules.rates import MIN_GAP_SECONDS

# An aircraft silent for longer probably left the coverage zone: it is no longer evaluated,
# so it does not raise R1 and R2 alerts forever.
SILENCE_LIMIT = timedelta(minutes=30)

# The replayed traffic has a point every second, so a window of 30 minutes would read millions
# of rows. A minute is enough to find the latest point of an aircraft and, 10 s or more before
# it, the point that R3 to R5 compare it with.
REPLAY_SILENCE_LIMIT = timedelta(minutes=1)


def to_float(value: object) -> float | None:
    return None if value is None else float(value)


class SnapshotReader:
    """Reads, for each recently heard aircraft, the observations the rules need."""

    def __init__(
        self,
        session: AsyncSession,
        silence_limit: timedelta = SILENCE_LIMIT,
        replay_silence_limit: timedelta = REPLAY_SILENCE_LIMIT,
    ) -> None:
        self._session = session
        self._silence_limit = silence_limit
        self._replay_silence_limit = replay_silence_limit

    def recent_query(self, now: datetime, mode: DataMode = DataMode.LIVE) -> Select:
        """The observations of the aircraft heard in the window, ranked from the latest.

        Live, only the latest observation of each aircraft and the one before it in each of
        its flights are kept. The window bounds the scan: an older previous observation would be
        more than 300 s away, so R3 to R5 would ignore the pair anyway. It has no upper bound:
        `now` is the start of the collection, and the contacts that collection stores can be
        later than it (the time of the request, or a clock a few seconds ahead of ours).
        Excluding them would evaluate the rules on the previous collection.

        In a replay, `now` is an instant of the past: the window is closed at `now`, or every
        later point of the dataset would count as the latest one. The window is short, so every
        row in it is kept and `read` picks the previous observation itself.
        """
        live = mode is DataMode.LIVE
        window = self._silence_limit if live else self._replay_silence_limit
        conditions = [
            Observation.deleted_at.is_(None),
            Aircraft.deleted_at.is_(None),
            mode.matches(Aircraft.source_id),
            Observation.last_contact_at > now - window,
        ]
        if not live:
            conditions.append(Observation.last_contact_at <= now)
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
            .where(*conditions)
            .subquery("ranked")
        )
        query = select(ranked)
        if live:
            query = query.where((ranked.c.aircraft_rank == 1) | (ranked.c.flight_rank == 2))
        return query.order_by(ranked.c.aircraft_id, ranked.c.aircraft_rank)

    @staticmethod
    def positioned_query(aircraft_ids: list[int]) -> Select:
        """The latest observation with a position of each given aircraft, for R2. No upper
        bound either, for the same reason as `recent_query`.

        One LATERAL subquery per aircraft, limited to one row: it walks the unique index
        (ID_AERONEF, DT_DERNIER_CONTACT) backwards and stops at the first position, instead
        of reading the whole history of the aircraft as a DISTINCT ON would.
        """
        latest = (
            select(
                Observation.flight_id,
                Observation.last_contact_at,
                Observation.position_at,
                Observation.altitude,
                Observation.speed,
                Observation.heading,
                Observation.on_ground,
            )
            .where(
                Observation.aircraft_id == Aircraft.id,
                Observation.deleted_at.is_(None),
                Observation.position_at.is_not(None),
            )
            .order_by(Observation.last_contact_at.desc())
            .limit(1)
            .lateral("positioned")
        )
        return (
            select(Aircraft.id.label("aircraft_id"), latest)
            .select_from(Aircraft)
            .join(latest, true())
            .where(Aircraft.id.in_(aircraft_ids))
        )

    async def read(self, now: datetime, mode: DataMode = DataMode.LIVE) -> list[AircraftSnapshot]:
        """One snapshot per aircraft heard in the window before `now`."""
        rows = (await self._session.execute(self.recent_query(now, mode))).all()
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

        # R2 reads the latest position, and is not evaluated in a replay: no lookup there.
        positioned: dict[int, StateSample] = {}
        if mode is DataMode.LIVE:
            positioned_rows = await self._session.execute(self.positioned_query(list(latest)))
            positioned = {row.aircraft_id: self.to_sample(row) for row in positioned_rows.all()}

        snapshots = []
        for aircraft_id, row in latest.items():
            previous = self._previous(row, others.get(aircraft_id, []), mode)
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
    def _previous(latest: Row, candidates: list[Row], mode: DataMode) -> Row | None:
        """The observation to compare `latest` with, in the same flight.

        Live, it is the one just before. In a replay, the points are a second apart and the
        rates ignore a pair closer than `MIN_GAP_SECONDS`: it is the nearest one at least that
        far back. The candidates come from the latest to the oldest.
        """
        if latest.flight_id is None:
            return None
        for other in candidates:
            if other.flight_id != latest.flight_id:
                continue
            if mode is DataMode.LIVE:
                return other
            if (latest.last_contact_at - other.last_contact_at).total_seconds() >= MIN_GAP_SECONDS:
                return other
        return None

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
