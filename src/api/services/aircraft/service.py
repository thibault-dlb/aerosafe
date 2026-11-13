from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, func, or_, select, true
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import FromClause

from core.data_mode import REPLAY_WINDOW, DataMode
from core.repository import Repository
from models import Aircraft, AircraftModel, Airline, Observation
from schemas.aircraft import AircraftSummary

WGS84 = 4326


@dataclass(frozen=True)
class BoundingBox:
    """A geographic area, in degrees (WGS 84)."""

    south: float
    west: float
    north: float
    east: float

    def __post_init__(self) -> None:
        if not -90 <= self.south <= self.north <= 90:
            raise ValueError("Latitudes must satisfy -90 <= south <= north <= 90")
        if not -180 <= self.west <= self.east <= 180:
            raise ValueError("Longitudes must satisfy -180 <= west <= east <= 180")


@dataclass(frozen=True)
class AircraftSearchCriteria:
    """Search criteria of UC-01. Every criterion is optional and they are combined with AND.

    `mode` picks the source of the aircraft: the live collection, or the replayed history, in
    which case `at` is the simulated instant and only the aircraft heard in the minute before
    it are listed, with their position at that instant.
    """

    icao24: str | None = None
    registration: str | None = None
    airline: str | None = None
    area: BoundingBox | None = None
    limit: int = 50
    mode: DataMode = DataMode.LIVE
    at: datetime | None = None


def escape_like(value: str) -> str:
    """Escape the LIKE wildcards of user input, so `%` and `_` match themselves."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class AircraftService:
    """Search and look up aircraft (BF-04, BF-05)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._aircraft = Repository(session, Aircraft)

    @staticmethod
    def latest_observation(at: datetime | None = None) -> FromClause:
        """The latest observation of the aircraft of the outer query, up to `at` if given.

        One LATERAL subquery for each aircraft, limited to one row: it walks the unique index
        (ID_AERONEF, DT_DERNIER_CONTACT) backwards and stops at the first row. It never reads
        the observations of the other aircraft, whatever the size of the table, as a
        DISTINCT ON over all of them would.
        """
        conditions = [Observation.aircraft_id == Aircraft.id, Observation.deleted_at.is_(None)]
        if at is not None:
            conditions.append(Observation.last_contact_at <= at)
        return (
            select(
                Observation.last_contact_at,
                Observation.position,
                func.ST_Y(Observation.position).label("latitude"),
                func.ST_X(Observation.position).label("longitude"),
            )
            .where(*conditions)
            .order_by(Observation.last_contact_at.desc())
            .limit(1)
            .lateral("latest")
        )

    @staticmethod
    def replay_observations(at: datetime) -> FromClause:
        """The latest observation, at the simulated instant `at`, of each aircraft heard in the
        minute before: a range of the index on the contact time, a few thousand rows."""
        return (
            select(
                Observation.aircraft_id,
                Observation.last_contact_at,
                Observation.position,
                func.ST_Y(Observation.position).label("latitude"),
                func.ST_X(Observation.position).label("longitude"),
            )
            .where(
                Observation.deleted_at.is_(None),
                Observation.last_contact_at > at - REPLAY_WINDOW,
                Observation.last_contact_at <= at,
            )
            .ext(distinct_on(Observation.aircraft_id))
            .order_by(Observation.aircraft_id, Observation.last_contact_at.desc())
            .subquery("latest")
        )

    def summary_query(
        self, at: datetime | None = None, windowed: bool = False
    ) -> tuple[Select, FromClause]:
        """Aircraft with their model, airline and latest observation, deleted rows excluded.

        `windowed` keeps only the aircraft heard in the minute before `at` (a replay);
        otherwise every aircraft is kept, with its latest observation up to `at` if given.
        """
        statement = (
            self._aircraft.select()
            .add_columns(
                AircraftModel.label.label("model_label"),
                Airline.label.label("airline_label"),
            )
            .outerjoin(AircraftModel, Aircraft.model_id == AircraftModel.id)
            .outerjoin(Airline, Aircraft.airline_id == Airline.id)
        )
        if windowed:
            if at is None:
                raise ValueError("A replay needs the simulated instant")
            latest = self.replay_observations(at)
            statement = statement.join(latest, latest.c.aircraft_id == Aircraft.id)
        else:
            latest = self.latest_observation(at)
            statement = statement.outerjoin(latest, true())
        statement = statement.add_columns(
            latest.c.last_contact_at, latest.c.latitude, latest.c.longitude
        )
        return statement, latest

    def search_query(self, criteria: AircraftSearchCriteria) -> Select:
        statement, latest = self.summary_query(
            criteria.at, windowed=criteria.mode is DataMode.REPLAY
        )
        # The address is unique for each source: a replayed aircraft can share it with a real one.
        statement = statement.where(criteria.mode.matches(Aircraft.source_id))
        if criteria.icao24:
            statement = statement.where(
                Aircraft.icao24.like(f"{escape_like(criteria.icao24.lower())}%", escape="\\")
            )
        if criteria.registration:
            statement = statement.where(
                Aircraft.registration.ilike(f"%{escape_like(criteria.registration)}%", escape="\\")
            )
        if criteria.airline:
            pattern = f"%{escape_like(criteria.airline)}%"
            statement = statement.where(
                or_(
                    Airline.label.ilike(pattern, escape="\\"),
                    Airline.code.ilike(pattern, escape="\\"),
                )
            )
        if criteria.area:
            box = criteria.area
            envelope = func.ST_MakeEnvelope(box.west, box.south, box.east, box.north, WGS84)
            statement = statement.where(func.ST_Intersects(latest.c.position, envelope))
        return statement.order_by(Aircraft.icao24).limit(criteria.limit)

    async def search(self, criteria: AircraftSearchCriteria) -> list[AircraftSummary]:
        """Aircraft matching every given criterion, sorted by ICAO24 address."""
        result = await self._session.execute(self.search_query(criteria))
        return [self.to_summary(row) for row in result.all()]

    async def get(self, public_id: str, at: datetime | None = None) -> AircraftSummary | None:
        """The record of one aircraft, or None when it does not exist or was deleted.

        `at` is the simulated instant of a replay: the position is the latest one up to it."""
        statement, _ = self.summary_query(at)
        result = await self._session.execute(statement.where(Aircraft.public_id == public_id))
        row = result.first()
        return None if row is None else self.to_summary(row)

    @staticmethod
    def to_summary(row: Row) -> AircraftSummary:
        aircraft: Aircraft = row[0]
        return AircraftSummary(
            id=aircraft.public_id,
            icao24=aircraft.icao24,
            registration=aircraft.registration,
            model=row.model_label,
            airline=row.airline_label,
            last_contact_at=row.last_contact_at,
            latitude=row.latitude,
            longitude=row.longitude,
        )
