"""ObservationPurger against a real PostgreSQL with the migrations applied.

Uses the session fixture of tests/integration/conftest.py, rolled back after each test.
"""

import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from services.collection.flight_grouper import FlightGrouper
from services.collection.normalizer import NormalizedState
from services.collection.purge import ObservationPurger
from services.collection.store import ObservationStore

pytestmark = pytest.mark.integration

NOW = datetime(2026, 11, 20, 12, tzinfo=UTC)
WEEK = timedelta(days=7)


def state(aircraft: str, at: datetime) -> NormalizedState:
    return NormalizedState(
        icao24=aircraft,
        callsign="TEST1",
        last_contact_at=at,
        position_at=at,
        latitude=48.65,
        longitude=2.5,
        altitude=Decimal("10000.0"),
        speed=Decimal("230.00"),
        heading=Decimal("90.00"),
        on_ground=False,
    )


async def stored(session: AsyncSession, mode: DataMode, aircraft: str, *ats: datetime) -> None:
    store = ObservationStore(session, FlightGrouper(timedelta(minutes=30)), mode)
    for at in ats:
        await store.save([state(aircraft, at)])
    await store.close_stale_flights(NOW)


async def points_of(session: AsyncSession, mode: DataMode, aircraft: str) -> list[datetime]:
    statement = (
        select(Observation.last_contact_at)
        .join(Aircraft, Aircraft.id == Observation.aircraft_id)
        .where(Aircraft.icao24 == aircraft, mode.matches(Aircraft.source_id))
        .order_by(Observation.last_contact_at)
    )
    return list(await session.scalars(statement))


def purger_on(session: AsyncSession, batch_size: int = 1) -> ObservationPurger:
    @asynccontextmanager
    async def same_session():
        yield session

    # The commits of the purge release savepoints: the fixture still rolls everything back.
    return ObservationPurger(
        WEEK, batch_size=batch_size, session_factory=same_session, clock=lambda: NOW
    )


async def test_only_the_old_adsbfi_points_are_deleted(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    old, recent = NOW - WEEK - timedelta(hours=1), NOW - timedelta(hours=1)
    await stored(session, DataMode.ADSBFI, aircraft, old, recent)
    await stored(session, DataMode.OPENSKY, aircraft, old, recent)

    report = await purger_on(session).run()

    assert report.observations >= 1
    assert await points_of(session, DataMode.ADSBFI, aircraft) == [recent]
    assert await points_of(session, DataMode.OPENSKY, aircraft) == [old, recent]


async def test_the_replayed_points_are_never_deleted(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    replayed = datetime(2022, 8, 14, 15, tzinfo=UTC)
    await stored(session, DataMode.REPLAY, aircraft, replayed)

    await purger_on(session).run()

    assert await points_of(session, DataMode.REPLAY, aircraft) == [replayed]


async def test_an_emptied_flight_is_soft_deleted_and_its_aircraft_stays(
    session: AsyncSession,
) -> None:
    aircraft = secrets.token_hex(3)
    await stored(session, DataMode.ADSBFI, aircraft, NOW - WEEK - timedelta(days=1))

    report = await purger_on(session).run()

    assert report.flights >= 1
    flights = (
        await session.execute(
            select(func.count(Flight.id))
            .join(Aircraft, Aircraft.id == Flight.aircraft_id)
            .where(Aircraft.icao24 == aircraft, Flight.deleted_at.is_(None))
        )
    ).scalar_one()
    assert flights == 0
    assert await session.scalar(select(Aircraft.id).where(Aircraft.icao24 == aircraft))
