from datetime import datetime
from typing import Any

from geoalchemy2 import WKTElement
from sqlalchemy import BigInteger, ColumnElement, Text, any_, func, literal, select, update
from sqlalchemy.dialects.postgresql import ARRAY, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import TypeEngine

from core.data_mode import DataMode
from core.models import new_ulid
from core.repository import Repository
from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from services.collection.flight_grouper import FlightDecision, FlightGrouper, OpenFlight
from services.collection.normalizer import NormalizedState

WGS84 = 4326


def _any_of(values: list[Any], item_type: TypeEngine[Any]) -> ColumnElement[Any]:
    """`= ANY(:values)` with one array parameter, instead of one parameter per value."""
    return any_(literal(values, ARRAY(item_type)))


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

        # Every flight is decided first; the new ones are then inserted in one flush.
        flights = [
            self._flight_for(aircraft_ids[state.icao24], open_flights, state) for state in states
        ]
        await self._session.flush()
        rows = [
            self._observation_row(aircraft_ids[state.icao24], flight.id, state)
            for state, flight in zip(states, flights, strict=True)
        ]

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
            .where(
                Flight.ended_at.is_(None),
                Flight.deleted_at.is_(None),
                Observation.deleted_at.is_(None),
            )
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
        """Create the aircraft seen for the first time, then map every ICAO24 to its key.

        A soft-deleted aircraft keeps its row, so the insert skips it: it is read back with
        the others and its observations are still stored.
        """
        # The source is the default of the column (DIRECT): the collector only knows live data.
        await self._session.execute(
            insert(Aircraft).on_conflict_do_nothing(
                index_elements=["CD_ICAO24", "ID_SOURCE_DONNEE"]
            ),
            [{"icao24": icao24, "public_id": new_ulid()} for icao24 in sorted(icao24s)],
        )
        statement = self._aircraft.select(include_deleted=True).where(
            Aircraft.icao24 == _any_of(sorted(icao24s), Text()),
            DataMode.LIVE.matches(Aircraft.source_id),
        )
        return {aircraft.icao24: aircraft.id for aircraft in await self._session.scalars(statement)}

    async def _open_flights(self, aircraft_ids: list[int]) -> dict[int, tuple[Flight, OpenFlight]]:
        flights = list(
            await self._session.scalars(
                self._flights.select().where(
                    Flight.aircraft_id == _any_of(aircraft_ids, BigInteger()),
                    Flight.ended_at.is_(None),
                )
            )
        )
        if not flights:
            return {}
        last_seen = dict(
            (
                await self._session.execute(
                    select(Observation.flight_id, func.max(Observation.last_contact_at))
                    .where(
                        Observation.flight_id == _any_of([f.id for f in flights], BigInteger()),
                        Observation.deleted_at.is_(None),
                    )
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

    def _flight_for(
        self,
        aircraft_id: int,
        open_flights: dict[int, tuple[Flight, OpenFlight]],
        state: NormalizedState,
    ) -> Flight:
        """The flight of the state; a new one is added to the session, not flushed yet."""
        current = open_flights.get(aircraft_id)
        decision = self._grouper.decide(current[1] if current else None, state)
        if decision is FlightDecision.JOIN and current:
            flight, _ = current
            if flight.callsign is None and state.callsign:
                flight.callsign = state.callsign
            return flight

        if current:
            previous, summary = current
            previous.ended_at = max(summary.last_seen_at, previous.started_at)
        flight = Flight(
            aircraft_id=aircraft_id,
            callsign=state.callsign,
            started_at=state.last_contact_at,
        )
        self._session.add(flight)
        open_flights[aircraft_id] = (
            flight,
            OpenFlight(None, flight.callsign, state.last_contact_at),
        )
        return flight

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
