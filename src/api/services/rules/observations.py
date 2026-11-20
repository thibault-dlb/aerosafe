from datetime import datetime, timedelta

from sqlalchemy import Select, func, select, true
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import REPLAY_WINDOW, DataMode
from models import Aircraft, Observation
from services.rules.base import AircraftSnapshot, StateSample
from services.rules.rates import MIN_GAP_SECONDS

# An aircraft silent for longer probably left the coverage zone: it is no longer evaluated,
# so it does not raise R1 and R2 alerts forever.
SILENCE_LIMIT = timedelta(minutes=30)

# A minute is enough to find the latest point of a replayed aircraft and, 10 s or more before
# it, the point that R3 to R5 compare it with.
REPLAY_SILENCE_LIMIT = REPLAY_WINDOW

# The rates ignore a pair closer than this, so the previous point is at least this far back.
MIN_GAP = timedelta(seconds=MIN_GAP_SECONDS)

# Prefix of the columns of the previous observation in a live row.
_PREVIOUS = "previous_"


def to_float(value: object) -> float | None:
    return None if value is None else float(value)


def _sample_columns() -> list:
    """The columns of an observation that a `StateSample` holds."""
    return [
        Observation.flight_id,
        Observation.last_contact_at,
        Observation.position_at,
        Observation.altitude,
        Observation.speed,
        Observation.heading,
        Observation.on_ground,
        func.ST_Y(Observation.position).label("latitude"),
        func.ST_X(Observation.position).label("longitude"),
    ]


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

    def ranked_query(self, now: datetime, mode: DataMode) -> Select:
        """The observations of the aircraft of the source heard in the window, ranked from the
        latest for each aircraft.

        Live, the window has no upper bound: `now` is the start of the collection, and the
        contacts that collection stores can be later than it (the time of the request, or a
        clock a few seconds ahead of ours). Excluding them would evaluate the rules on the
        previous collection. In a replay, `now` is an instant of the past: the window is closed
        at `now`, or every later point of the dataset would count as the latest one.
        """
        window = self._silence_limit if mode.is_live else self._replay_silence_limit
        conditions = [
            Observation.deleted_at.is_(None),
            Aircraft.deleted_at.is_(None),
            mode.matches(Aircraft.source_id),
            Observation.last_contact_at > now - window,
        ]
        if not mode.is_live:
            conditions.append(Observation.last_contact_at <= now)
        return (
            select(
                Observation.aircraft_id,
                Aircraft.icao24,
                *_sample_columns(),
                func.row_number()
                .over(
                    partition_by=Observation.aircraft_id,
                    order_by=Observation.last_contact_at.desc(),
                )
                .label("aircraft_rank"),
            )
            .join(Aircraft, Aircraft.id == Observation.aircraft_id)
            .where(*conditions)
        )

    def recent_query(self, now: datetime, mode: DataMode = DataMode.OPENSKY) -> Select:
        """The observations the rules compare, for each aircraft heard in the window.

        Live, one row per aircraft: its latest observation, and in `previous_*` columns the
        observation of the same flight nearest to it and at least `MIN_GAP` back, the pair that
        R3 to R5 compare. The one just before would be too close at the 5 s period of adsb.fi.
        It is found by one LATERAL subquery per aircraft, which walks the index
        (ID_VOL, DT_DERNIER_CONTACT) backwards and stops at the first row.

        In a replay the window is a minute, so every row in it is kept and `read` picks the
        previous observation itself.
        """
        ranked = self.ranked_query(now, mode).subquery("ranked")
        if not mode.is_live:
            return select(ranked).order_by(ranked.c.aircraft_id, ranked.c.aircraft_rank)

        latest = select(ranked).where(ranked.c.aircraft_rank == 1).subquery("latest")
        previous = (
            select(*_sample_columns())
            .where(
                Observation.flight_id == latest.c.flight_id,
                Observation.deleted_at.is_(None),
                Observation.last_contact_at <= latest.c.last_contact_at - MIN_GAP,
            )
            .order_by(Observation.last_contact_at.desc())
            .limit(1)
            .lateral("previous")
        )
        return (
            select(
                latest,
                *(column.label(f"{_PREVIOUS}{column.key}") for column in previous.c),
            )
            .outerjoin(previous, true())
            .order_by(latest.c.aircraft_id)
        )

    @staticmethod
    def positioned_query(aircraft_ids: list[int]) -> Select:
        """The latest observation with a position of each given aircraft, for R2. No upper
        bound either, for the same reason as `recent_query`.

        One LATERAL subquery per aircraft, limited to one row: it walks the unique index
        (ID_AERONEF, DT_DERNIER_CONTACT) backwards and stops at the first position, instead
        of reading the whole history of the aircraft as a DISTINCT ON would.
        """
        latest = (
            select(*_sample_columns())
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

    async def read(
        self, now: datetime, mode: DataMode = DataMode.OPENSKY
    ) -> list[AircraftSnapshot]:
        """One snapshot per aircraft heard in the window before `now`."""
        rows = (await self._session.execute(self.recent_query(now, mode))).all()
        if mode.is_live:
            latest = {row.aircraft_id: row for row in rows}
            previous = {row.aircraft_id: self._previous_of(row) for row in rows}
        else:
            latest, previous = self._pairs_of_a_replay(rows)
        if not latest:
            return []

        # R2 reads the latest position, and is not evaluated in a replay: no lookup there.
        positioned: dict[int, StateSample] = {}
        if mode.is_live:
            positioned_rows = await self._session.execute(self.positioned_query(list(latest)))
            positioned = {row.aircraft_id: self.to_sample(row) for row in positioned_rows.all()}

        return [
            AircraftSnapshot(
                aircraft_id=aircraft_id,
                icao24=row.icao24,
                latest=self.to_sample(row),
                previous=previous.get(aircraft_id),
                latest_with_position=positioned.get(aircraft_id),
            )
            for aircraft_id, row in latest.items()
        ]

    @classmethod
    def _previous_of(cls, row: Row) -> StateSample | None:
        """The previous observation carried by a live row, if the LATERAL found one."""
        if row.flight_id is None or getattr(row, f"{_PREVIOUS}last_contact_at") is None:
            return None
        return StateSample(
            last_contact_at=getattr(row, f"{_PREVIOUS}last_contact_at"),
            position_at=getattr(row, f"{_PREVIOUS}position_at"),
            altitude=to_float(getattr(row, f"{_PREVIOUS}altitude")),
            speed=to_float(getattr(row, f"{_PREVIOUS}speed")),
            heading=to_float(getattr(row, f"{_PREVIOUS}heading")),
            on_ground=getattr(row, f"{_PREVIOUS}on_ground"),
            flight_id=getattr(row, f"{_PREVIOUS}flight_id"),
            latitude=getattr(row, f"{_PREVIOUS}latitude"),
            longitude=getattr(row, f"{_PREVIOUS}longitude"),
        )

    @classmethod
    def _pairs_of_a_replay(
        cls, rows: list[Row]
    ) -> tuple[dict[int, Row], dict[int, StateSample | None]]:
        """The latest row of each replayed aircraft, and the observation to compare it with:
        the points are a second apart and the rates ignore a pair closer than `MIN_GAP`, so it
        is the nearest one of the same flight at least that far back. The rows come from the
        latest to the oldest for each aircraft."""
        latest: dict[int, Row] = {}
        previous: dict[int, StateSample | None] = {}
        for row in rows:
            if row.aircraft_rank == 1:
                latest[row.aircraft_id] = row
                previous[row.aircraft_id] = None
                continue
            current = latest.get(row.aircraft_id)
            if (
                current is None
                or current.flight_id is None
                or previous[row.aircraft_id] is not None
                or row.flight_id != current.flight_id
            ):
                continue
            if current.last_contact_at - row.last_contact_at >= MIN_GAP:
                previous[row.aircraft_id] = cls.to_sample(row)
        return latest, previous

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
            latitude=to_float(getattr(row, "latitude", None)),
            longitude=to_float(getattr(row, "longitude", None)),
        )
