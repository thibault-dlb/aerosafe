from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from models import Aircraft, Flight, Observation
from schemas.aircraft import ObservationPoint

# Upper bound of a trajectory: about 80 hours at one observation every 30 s.
MAX_FLIGHT_POINTS = 10_000


@dataclass(frozen=True)
class ObservationPeriod:
    """Time window of an observation history. Both bounds are optional and inclusive."""

    start: datetime | None = None
    end: datetime | None = None
    limit: int = 500

    def __post_init__(self) -> None:
        if self.start and self.end and self.start > self.end:
            raise ValueError("The start of the period must not be after its end")


def to_float(value: object) -> float | None:
    return None if value is None else float(value)


class ObservationReader:
    """Reads observations as flight parameters (BF-06). Shared by the aircraft and the flights."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def points_query() -> Select:
        """Active observations with their position in degrees and the ULID of their flight."""
        return (
            select(
                Observation.last_contact_at,
                Observation.position_at,
                func.ST_Y(Observation.position).label("latitude"),
                func.ST_X(Observation.position).label("longitude"),
                Observation.altitude,
                Observation.speed,
                Observation.heading,
                Observation.on_ground,
                Flight.public_id.label("flight_public_id"),
            )
            .outerjoin(Flight, Observation.flight_id == Flight.id)
            .where(Observation.deleted_at.is_(None))
        )

    def history_query(self, aircraft_public_id: str, period: ObservationPeriod) -> Select:
        """Latest observations of one aircraft in the period, newest first."""
        statement = (
            self.points_query()
            .join(Aircraft, Observation.aircraft_id == Aircraft.id)
            .where(Aircraft.public_id == aircraft_public_id)
        )
        if period.start:
            statement = statement.where(Observation.last_contact_at >= period.start)
        if period.end:
            statement = statement.where(Observation.last_contact_at <= period.end)
        return statement.order_by(Observation.last_contact_at.desc()).limit(period.limit)

    async def history(
        self, aircraft_public_id: str, period: ObservationPeriod
    ) -> list[ObservationPoint]:
        """Observations of one aircraft in chronological order, the latest `limit` of the period."""
        result = await self._session.execute(self.history_query(aircraft_public_id, period))
        return [self.to_point(row) for row in reversed(result.all())]

    def flight_query(self, flight_id: int, limit: int = MAX_FLIGHT_POINTS) -> Select:
        """Observations of one flight, oldest first."""
        return (
            self.points_query()
            .where(Observation.flight_id == flight_id)
            .order_by(Observation.last_contact_at)
            .limit(limit)
        )

    async def flight(self, flight_id: int) -> list[ObservationPoint]:
        """The trajectory of one flight, from its internal key, in chronological order."""
        result = await self._session.execute(self.flight_query(flight_id))
        return [self.to_point(row) for row in result.all()]

    @staticmethod
    def to_point(row: Row) -> ObservationPoint:
        return ObservationPoint(
            last_contact_at=row.last_contact_at,
            position_at=row.position_at,
            latitude=row.latitude,
            longitude=row.longitude,
            altitude=to_float(row.altitude),
            speed=to_float(row.speed),
            heading=to_float(row.heading),
            on_ground=row.on_ground,
            flight_id=row.flight_public_id,
        )
