from dataclasses import dataclass

from sqlalchemy import Select, func, or_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Subquery

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
    """Search criteria of UC-01. Every criterion is optional and they are combined with AND."""

    icao24: str | None = None
    registration: str | None = None
    airline: str | None = None
    area: BoundingBox | None = None
    limit: int = 50


def escape_like(value: str) -> str:
    """Escape the LIKE wildcards of user input, so `%` and `_` match themselves."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class AircraftService:
    """Search and look up aircraft (BF-04, BF-05)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._aircraft = Repository(session, Aircraft)

    @staticmethod
    def latest_observations() -> Subquery:
        """Latest observation of every aircraft, with its position split into degrees."""
        return (
            select(
                Observation.aircraft_id,
                Observation.last_contact_at,
                Observation.position,
                func.ST_Y(Observation.position).label("latitude"),
                func.ST_X(Observation.position).label("longitude"),
            )
            .where(Observation.deleted_at.is_(None))
            .ext(distinct_on(Observation.aircraft_id))
            .order_by(Observation.aircraft_id, Observation.last_contact_at.desc())
            .subquery("latest")
        )

    def summary_query(self) -> tuple[Select, Subquery]:
        """Aircraft with their model, airline and latest observation, deleted rows excluded."""
        latest = self.latest_observations()
        statement = (
            self._aircraft.select()
            .add_columns(
                AircraftModel.label.label("model_label"),
                Airline.label.label("airline_label"),
                latest.c.last_contact_at,
                latest.c.latitude,
                latest.c.longitude,
            )
            .outerjoin(AircraftModel, Aircraft.model_id == AircraftModel.id)
            .outerjoin(Airline, Aircraft.airline_id == Airline.id)
            .outerjoin(latest, latest.c.aircraft_id == Aircraft.id)
        )
        return statement, latest

    def search_query(self, criteria: AircraftSearchCriteria) -> Select:
        statement, latest = self.summary_query()
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

    async def get(self, public_id: str) -> AircraftSummary | None:
        """The record of one aircraft, or None when it does not exist or was deleted."""
        statement, _ = self.summary_query()
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
