from datetime import datetime
from typing import Any

from geoalchemy2 import WKTElement
from sqlalchemy import (
    BigInteger,
    ColumnElement,
    Text,
    and_,
    any_,
    func,
    literal,
    or_,
    select,
    true,
    update,
)
from sqlalchemy.dialects.postgresql import ARRAY, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import TypeEngine

from core.data_mode import DataMode
from core.models import new_ulid
from core.repository import Repository
from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from models.reference import AircraftModel, DataSource
from services.collection.flight_grouper import FlightDecision, FlightGrouper, OpenFlight
from services.collection.normalizer import NormalizedState

WGS84 = 4326


def _any_of(values: list[Any], item_type: TypeEngine[Any]) -> ColumnElement[Any]:
    """`= ANY(:values)` with one array parameter, instead of one parameter per value."""
    return any_(literal(values, ARRAY(item_type)))


def _latest_contact() -> Any:
    """The latest contact of the flight of the outer query, read backwards on the index
    (ID_VOL, DT_DERNIER_CONTACT) and stopped at the first row: it never reads the whole
    history of the flight, which at 5 s holds hundreds of points an hour."""
    return (
        select(Observation.last_contact_at)
        .where(Observation.flight_id == Flight.id, Observation.deleted_at.is_(None))
        .order_by(Observation.last_contact_at.desc())
        .limit(1)
    )


class ObservationStore:
    """Stores one collection of a live source: aircraft, flights and observations, in the
    caller's transaction. Every aircraft and flight it reads or writes is one of its source."""

    def __init__(
        self, session: AsyncSession, grouper: FlightGrouper, mode: DataMode = DataMode.OPENSKY
    ) -> None:
        self._session = session
        self._grouper = grouper
        self._mode = mode
        self._aircraft = Repository(session, Aircraft)
        self._flights = Repository(session, Flight)

    async def save(self, states: list[NormalizedState]) -> int:
        """Store the states and return how many observations are new."""
        if not states:
            return 0
        aircraft_ids = await self._ensure_aircraft(states)
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
        """Close the open flights of the source whose latest observation is older than the
        flight gap, at that observation."""
        last_seen = _latest_contact().correlate(Flight).scalar_subquery()
        of_source = (
            select(Aircraft.id)
            .where(Aircraft.id == Flight.aircraft_id, self._mode.matches(Aircraft.source_id))
            .correlate(Flight)
            .exists()
        )
        statement = (
            update(Flight)
            .where(
                Flight.ended_at.is_(None),
                Flight.deleted_at.is_(None),
                of_source,
                last_seen < self._grouper.stale_before(now),
            )
            .values(ended_at=last_seen)
            .execution_options(synchronize_session=False)
        )
        result = await self._session.execute(statement)
        return result.rowcount or 0

    async def _ensure_aircraft(self, states: list[NormalizedState]) -> dict[str, int]:
        """Create the aircraft seen for the first time in the source, fill or correct the
        registration and the model it sends, then map every ICAO24 to its key.

        A value the source does not send never erases a known one, and an aircraft whose
        values did not change is not written. A soft-deleted aircraft keeps its row: it is read
        back with the others and its observations are still stored.
        """
        source_id = await self._source_id()
        model_ids = await self._ensure_models(states)
        by_icao24 = {state.icao24: state for state in states}
        statement = insert(Aircraft)
        excluded = statement.excluded
        statement = statement.on_conflict_do_update(
            index_elements=["CD_ICAO24", "ID_SOURCE_DONNEE"],
            set_={
                Aircraft.registration: func.coalesce(
                    excluded.LB_IMMATRICULATION, Aircraft.registration
                ),
                Aircraft.model_id: func.coalesce(excluded.ID_MODELE, Aircraft.model_id),
            },
            where=or_(
                and_(
                    excluded.LB_IMMATRICULATION.is_not(None),
                    Aircraft.registration.is_distinct_from(excluded.LB_IMMATRICULATION),
                ),
                and_(
                    excluded.ID_MODELE.is_not(None),
                    Aircraft.model_id.is_distinct_from(excluded.ID_MODELE),
                ),
            ),
        )
        await self._session.execute(
            statement,
            [
                {
                    "icao24": icao24,
                    "public_id": new_ulid(),
                    "source_id": source_id,
                    "registration": state.registration,
                    "model_id": model_ids.get(state.model_code) if state.model_code else None,
                }
                for icao24, state in sorted(by_icao24.items())
            ],
        )
        read = self._aircraft.select(include_deleted=True).where(
            Aircraft.icao24 == _any_of(sorted(by_icao24), Text()),
            self._mode.matches(Aircraft.source_id),
        )
        return {aircraft.icao24: aircraft.id for aircraft in await self._session.scalars(read)}

    async def _source_id(self) -> int:
        statement = select(DataSource.id).where(DataSource.code == self._mode.code)
        source_id = await self._session.scalar(statement)
        if source_id is None:
            raise LookupError(f"No data source {self._mode.code}: are the migrations applied?")
        return source_id

    async def _ensure_models(self, states: list[NormalizedState]) -> dict[str, int]:
        """Create the models seen for the first time, then map every model code to its key.

        The label of a model already known is kept.
        """
        labels = {
            state.model_code: state.model_label or state.model_code
            for state in states
            if state.model_code
        }
        if not labels:
            return {}
        await self._session.execute(
            insert(AircraftModel).on_conflict_do_nothing(index_elements=["CD_MODELE"]),
            [{"code": code, "label": label} for code, label in sorted(labels.items())],
        )
        rows = await self._session.execute(
            select(AircraftModel.code, AircraftModel.id).where(
                AircraftModel.code == _any_of(sorted(labels), Text())
            )
        )
        return {code: model_id for code, model_id in rows.all()}

    async def _open_flights(self, aircraft_ids: list[int]) -> dict[int, tuple[Flight, OpenFlight]]:
        """The open flight of each aircraft, with the time of its latest observation."""
        latest = _latest_contact().lateral("latest")
        statement = (
            self._flights.select()
            .add_columns(latest.c.last_contact_at)
            .outerjoin(latest, true())
            .where(
                Flight.aircraft_id == _any_of(aircraft_ids, BigInteger()),
                Flight.ended_at.is_(None),
            )
        )
        open_flights = {}
        for flight, last_seen_at in (await self._session.execute(statement)).all():
            # A flight without observation is dated from its start.
            seen = last_seen_at or flight.started_at
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
