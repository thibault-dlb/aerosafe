from sqlalchemy import Select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from core.repository import Repository
from models import Aircraft, Airport, Flight
from schemas.flight import FlightDetail, FlightSummary
from services.aircraft import ObservationReader
from services.flights.statistics import TrajectoryAnalyser

Origin = aliased(Airport, name="origin")
Destination = aliased(Airport, name="destination")


class FlightService:
    """Flights of an aircraft and their trajectory (BF-07, BF-08)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._flights = Repository(session, Flight)
        self._observations = ObservationReader(session)

    def summary_query(self) -> Select:
        """Active flights of active aircraft, with their airports."""
        return (
            self._flights.select()
            .add_columns(
                Aircraft.public_id.label("aircraft_public_id"),
                Aircraft.icao24,
                Aircraft.registration,
                Origin.label.label("origin_label"),
                Destination.label.label("destination_label"),
            )
            .join(Aircraft, Flight.aircraft_id == Aircraft.id)
            .outerjoin(Origin, Flight.origin_airport_id == Origin.id)
            .outerjoin(Destination, Flight.destination_airport_id == Destination.id)
            .where(Aircraft.deleted_at.is_(None))
        )

    def list_query(self, aircraft_public_id: str, limit: int) -> Select:
        return (
            self.summary_query()
            .where(Aircraft.public_id == aircraft_public_id)
            .order_by(Flight.started_at.desc())
            .limit(limit)
        )

    async def list_for_aircraft(
        self, aircraft_public_id: str, limit: int = 50
    ) -> list[FlightSummary]:
        """Flights of one aircraft, the most recent first."""
        result = await self._session.execute(self.list_query(aircraft_public_id, limit))
        return [self.to_summary(row) for row in result.all()]

    async def get(self, public_id: str) -> FlightDetail | None:
        """One flight with its trajectory, gaps and statistics, or None if it does not exist."""
        result = await self._session.execute(
            self.summary_query().where(Flight.public_id == public_id)
        )
        row = result.first()
        if row is None:
            return None
        flight: Flight = row[0]
        points = await self._observations.flight(flight.id)
        analyser = TrajectoryAnalyser(points)
        return FlightDetail(
            **self.to_summary(row).model_dump(),
            trajectory=points,
            gaps=analyser.gaps(),
            statistics=analyser.statistics(),
        )

    @staticmethod
    def to_summary(row: Row) -> FlightSummary:
        flight: Flight = row[0]
        return FlightSummary(
            id=flight.public_id,
            aircraft_id=row.aircraft_public_id,
            icao24=row.icao24,
            registration=row.registration,
            callsign=flight.callsign,
            started_at=flight.started_at,
            ended_at=flight.ended_at,
            origin=row.origin_label,
            destination=row.destination_label,
        )
