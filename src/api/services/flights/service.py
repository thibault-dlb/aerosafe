from datetime import datetime

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

    def list_query(self, aircraft_public_id: str, limit: int, at: datetime | None = None) -> Select:
        statement = self.summary_query().where(Aircraft.public_id == aircraft_public_id)
        if at is not None:
            statement = statement.where(Flight.started_at <= at)
        return statement.order_by(Flight.started_at.desc()).limit(limit)

    async def list_for_aircraft(
        self, aircraft_public_id: str, limit: int = 50, at: datetime | None = None
    ) -> list[FlightSummary]:
        """Flights of one aircraft, the most recent first.

        In a replay, `at` is the simulated instant: a flight that has not started yet is left
        out, and one that ends after it is still in progress."""
        result = await self._session.execute(self.list_query(aircraft_public_id, limit, at))
        return [self.to_summary(row, at) for row in result.all()]

    async def get(self, public_id: str, at: datetime | None = None) -> FlightDetail | None:
        """One flight with its trajectory, gaps and statistics, or None if it does not exist.

        In a replay, `at` is the simulated instant: the trajectory stops there, and a flight
        that has not started yet does not exist."""
        statement = self.summary_query().where(Flight.public_id == public_id)
        if at is not None:
            statement = statement.where(Flight.started_at <= at)
        result = await self._session.execute(statement)
        row = result.first()
        if row is None:
            return None
        flight: Flight = row[0]
        if at is None:
            points = await self._observations.flight(flight.id)
        else:
            points = await self._observations.flight(flight.id, at)
        analyser = TrajectoryAnalyser(points)
        return FlightDetail(
            **self.to_summary(row, at).model_dump(),
            trajectory=points,
            gaps=analyser.gaps(),
            statistics=analyser.statistics(),
        )

    @staticmethod
    def to_summary(row: Row, at: datetime | None = None) -> FlightSummary:
        flight: Flight = row[0]
        ended_at = flight.ended_at
        if at is not None and ended_at is not None and ended_at > at:
            ended_at = None
        return FlightSummary(
            id=flight.public_id,
            aircraft_id=row.aircraft_public_id,
            icao24=row.icao24,
            registration=row.registration,
            callsign=flight.callsign,
            started_at=flight.started_at,
            ended_at=ended_at,
            origin=row.origin_label,
            destination=row.destination_label,
        )
