from datetime import datetime

from geoalchemy2 import WKTElement
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.models import new_ulid
from core.repository import Repository
from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from services.collection.flight_grouper import FlightDecision, FlightGrouper, OpenFlight
from services.collection.normalizer import NormalizedState

WGS84 = 4326


class ObservationStore:
    """Stores one collection: aircraft, flights and observations, in the caller's transaction."""

    def __init__(self, session: AsyncSession, grouper: FlightGrouper) -> None:
        self._session = session
        self._grouper = grouper
        self._aircraft = Repository(session, Aircraft)
        self._flights = Repository(session, Flight)

    async def save(self, states: list[NormalizedState]) -> int:
        """Store the states and return how many observations are new."""
        if not states:
            return 0
        aircraft_ids = await self._ensure_aircraft({state.icao24 for state in states})
        open_flights = await self._open_flights(list(aircraft_ids.values()))

        rows = []
        for state in states:
            aircraft_id = aircraft_ids[state.icao24]
            flight_id = await self._flight_for(aircraft_id, open_flights, state)
            rows.append(self._observation_row(aircraft_id, flight_id, state))

        statement = (
            insert(Observation)
            .on_conflict_do_nothing(index_elements=["ID_AERONEF", "DT_DERNIER_CONTACT"])
            .returning(Observation.id)
        )
        stored = await self._session.scalars(statement, rows)
        return len(stored.all())

    async def close_stale_flights(self, now: datetime) -> int:
        """Close the open flights whose latest observation is older than the flight gap."""
        last_seen = (
            select(
                Observation.flight_id.label("flight_id"),
                func.max(Observation.last_contact_at).label("last_seen_at"),
            )
            .join(Flight, Flight.id == Observation.flight_id)
            .where(Flight.ended_at.is_(None), Flight.deleted_at.is_(None))
            .group_by(Observation.flight_id)
            .subquery()
        )
        statement = (
            update(Flight)
            .where(
                Flight.id == last_seen.c.flight_id,
                Flight.ended_at.is_(None),
                last_seen.c.last_seen_at < self._grouper.stale_before(now),
            )
            .values(ended_at=last_seen.c.last_seen_at)
            .execution_options(synchronize_session=False)
        )
        result = await self._session.execute(statement)
        return result.rowcount or 0

    async def _ensure_aircraft(self, icao24s: set[str]) -> dict[str, int]:
        """Create the aircraft seen for the first time, then map every ICAO24 to its key."""
        await self._session.execute(
            insert(Aircraft).on_conflict_do_nothing(index_elements=["CD_ICAO24"]),
            [{"icao24": icao24, "public_id": new_ulid()} for icao24 in sorted(icao24s)],
        )
        statement = self._aircraft.select().where(Aircraft.icao24.in_(icao24s))
        return {aircraft.icao24: aircraft.id for aircraft in await self._session.scalars(statement)}

    async def _open_flights(self, aircraft_ids: list[int]) -> dict[int, tuple[Flight, OpenFlight]]:
        flights = list(
            await self._session.scalars(
                self._flights.select().where(
                    Flight.aircraft_id.in_(aircraft_ids), Flight.ended_at.is_(None)
                )
            )
        )
        if not flights:
            return {}
        last_seen = dict(
            (
                await self._session.execute(
                    select(Observation.flight_id, func.max(Observation.last_contact_at))
                    .where(Observation.flight_id.in_([flight.id for flight in flights]))
                    .group_by(Observation.flight_id)
                )
            ).all()
        )
        open_flights = {}
        for flight in flights:
            seen = last_seen.get(flight.id, flight.started_at)
            open_flights[flight.aircraft_id] = (
                flight,
                OpenFlight(flight.id, flight.callsign, seen),
            )
        return open_flights

    async def _flight_for(
        self,
        aircraft_id: int,
        open_flights: dict[int, tuple[Flight, OpenFlight]],
        state: NormalizedState,
    ) -> int:
        current = open_flights.get(aircraft_id)
        decision = self._grouper.decide(current[1] if current else None, state)
        if decision is FlightDecision.JOIN and current:
            flight, _ = current
            if flight.callsign is None and state.callsign:
                flight.callsign = state.callsign
            return flight.id

        if current:
            previous, summary = current
            previous.ended_at = max(summary.last_seen_at, previous.started_at)
        flight = Flight(
            aircraft_id=aircraft_id,
            callsign=state.callsign,
            started_at=state.last_contact_at,
        )
        self._session.add(flight)
        await self._session.flush()
        open_flights[aircraft_id] = (
            flight,
            OpenFlight(flight.id, flight.callsign, state.last_contact_at),
        )
        return flight.id

    @staticmethod
    def _observation_row(
        aircraft_id: int, flight_id: int, state: NormalizedState
    ) -> dict[str, object]:
        position = (
            WKTElement(f"POINT({state.longitude} {state.latitude})", srid=WGS84)
            if state.has_position
            else None
        )
        return {
            "aircraft_id": aircraft_id,
            "flight_id": flight_id,
            "last_contact_at": state.last_contact_at,
            "position_at": state.position_at,
            "position": position,
            "altitude": state.altitude,
            "speed": state.speed,
            "heading": state.heading,
            "on_ground": state.on_ground,
        }
