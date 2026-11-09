"""ObservationStore against a real PostgreSQL with the migrations applied.

Uses the session fixture of tests/integration/conftest.py, rolled back after each test.
"""

import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from services.collection.flight_grouper import FlightGrouper
from services.collection.normalizer import NormalizedState
from services.collection.store import ObservationStore

pytestmark = pytest.mark.integration

T0 = datetime(2026, 11, 9, 10, tzinfo=UTC)
GAP = timedelta(minutes=30)


def icao24() -> str:
    return secrets.token_hex(3)


def state(
    aircraft: str,
    at: datetime,
    callsign: str | None = "AFR123",
    position: bool = True,
) -> NormalizedState:
    return NormalizedState(
        icao24=aircraft,
        callsign=callsign,
        last_contact_at=at,
        position_at=at if position else None,
        latitude=49.009712 if position else None,
        longitude=2.547831 if position else None,
        altitude=Decimal("10972.8"),
        speed=Decimal("231.46"),
        heading=Decimal("87.13"),
        on_ground=False,
    )


def store(session: AsyncSession) -> ObservationStore:
    return ObservationStore(session, FlightGrouper(GAP))


async def flights_of(session: AsyncSession, aircraft: str) -> list[Flight]:
    statement = (
        select(Flight)
        .join(Aircraft, Aircraft.id == Flight.aircraft_id)
        .where(Aircraft.icao24 == aircraft)
        .order_by(Flight.started_at)
    )
    return list(await session.scalars(statement))


async def test_a_first_observation_creates_the_aircraft_and_a_flight(
    session: AsyncSession,
) -> None:
    aircraft = icao24()

    assert await store(session).save([state(aircraft, T0)]) == 1

    created = await session.scalar(select(Aircraft).where(Aircraft.icao24 == aircraft))
    assert created is not None and len(created.public_id) == 26
    [flight] = await flights_of(session, aircraft)
    assert (flight.callsign, flight.started_at, flight.ended_at) == ("AFR123", T0, None)
    observation = await session.scalar(
        select(Observation).where(Observation.aircraft_id == created.id)
    )
    assert observation is not None and observation.flight_id == flight.id
    point = (
        await session.execute(
            select(
                func.ST_X(Observation.position),
                func.ST_Y(Observation.position),
                func.ST_SRID(Observation.position),
            ).where(Observation.id == observation.id)
        )
    ).one()
    assert tuple(point) == (2.547831, 49.009712, 4326)


async def test_the_same_state_vector_is_stored_once(session: AsyncSession) -> None:
    aircraft = icao24()

    assert await store(session).save([state(aircraft, T0)]) == 1
    assert await store(session).save([state(aircraft, T0)]) == 0


async def test_observations_within_the_gap_join_the_flight(session: AsyncSession) -> None:
    aircraft = icao24()

    await store(session).save([state(aircraft, T0, callsign=None)])
    await store(session).save([state(aircraft, T0 + timedelta(minutes=10), position=False)])

    [flight] = await flights_of(session, aircraft)
    # The callsign is filled once known.
    assert flight.callsign == "AFR123"


async def test_a_gap_or_a_new_callsign_starts_a_new_flight(session: AsyncSession) -> None:
    aircraft = icao24()
    later = T0 + GAP + timedelta(minutes=1)

    await store(session).save([state(aircraft, T0)])
    await store(session).save([state(aircraft, later)])
    await store(session).save([state(aircraft, later + timedelta(minutes=1), callsign="AFR456")])

    first, second, third = await flights_of(session, aircraft)
    assert first.ended_at == T0
    assert second.ended_at == later
    assert (third.callsign, third.ended_at) == ("AFR456", None)


async def test_stale_flights_are_closed_at_their_last_observation(session: AsyncSession) -> None:
    aircraft = icao24()
    await store(session).save([state(aircraft, T0), state(icao24(), T0 + GAP)])
    await store(session).save([state(aircraft, T0 + timedelta(minutes=5))])

    closed = await store(session).close_stale_flights(T0 + GAP + timedelta(minutes=6))

    assert closed >= 1
    [flight] = await flights_of(session, aircraft)
    await session.refresh(flight)
    assert flight.ended_at == T0 + timedelta(minutes=5)


async def test_a_soft_deleted_aircraft_does_not_block_the_collection(
    session: AsyncSession,
) -> None:
    aircraft = icao24()
    await store(session).save([state(aircraft, T0)])
    deleted = await session.scalar(select(Aircraft).where(Aircraft.icao24 == aircraft))
    assert deleted is not None
    deleted.deleted_at = T0
    await session.flush()

    stored = await store(session).save(
        [state(aircraft, T0 + timedelta(minutes=1)), state(icao24(), T0)]
    )

    assert stored == 2


async def test_an_empty_collection_stores_nothing(session: AsyncSession) -> None:
    assert await store(session).save([]) == 0
