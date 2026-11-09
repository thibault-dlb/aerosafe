"""RulesEngine against a real PostgreSQL with the migrations applied, R1 to R5 included.

Uses the session fixture of tests/integration/conftest.py, rolled back after each test.
"""

import secrets
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models import Aircraft, Alert, Rule
from services.collection.flight_grouper import FlightGrouper
from services.collection.normalizer import NormalizedState
from services.collection.store import ObservationStore
from services.rules.engine import RulesEngine

pytestmark = pytest.mark.integration

NOW = datetime(2026, 11, 9, 10, tzinfo=UTC)


def state(aircraft: str, seconds_ago: int, altitude: str = "10000.0") -> NormalizedState:
    at = NOW - timedelta(seconds=seconds_ago)
    return NormalizedState(
        icao24=aircraft,
        callsign="AFR123",
        last_contact_at=at,
        position_at=at,
        latitude=49.0,
        longitude=2.5,
        altitude=Decimal(altitude),
        speed=Decimal("230.00"),
        heading=Decimal("90.00"),
        on_ground=False,
    )


async def save(session: AsyncSession, *states: NormalizedState) -> None:
    store = ObservationStore(session, FlightGrouper(timedelta(minutes=30)))
    for item in states:
        await store.save([item])


async def alerts_of(session: AsyncSession, aircraft: str) -> list[tuple[str, Alert]]:
    statement = (
        select(Rule.code, Alert)
        .join(Rule, Rule.id == Alert.rule_id)
        .join(Aircraft, Aircraft.id == Alert.aircraft_id)
        .where(Aircraft.icao24 == aircraft)
        .order_by(Alert.triggered_at, Rule.code)
    )
    return [(code, alert) for code, alert in (await session.execute(statement)).all()]


async def test_a_steep_climb_raises_r3_once_per_episode(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    await save(session, state(aircraft, 60), state(aircraft, 30, altitude="11200.0"))

    await RulesEngine(session).evaluate(NOW)
    await RulesEngine(session).evaluate(NOW + timedelta(seconds=5))

    [(code, alert)] = await alerts_of(session, aircraft)
    assert code == "R3"
    assert alert.observed_value == Decimal("40.000")
    assert alert.threshold == Decimal("30.000")
    assert alert.triggered_at == NOW
    assert alert.criticality_id is not None
    assert len(alert.public_id) == 26


async def test_a_silent_aircraft_raises_r1_until_it_is_heard_again(
    session: AsyncSession,
) -> None:
    aircraft = secrets.token_hex(3)
    await save(session, state(aircraft, 420))

    await RulesEngine(session).evaluate(NOW)
    [(code, alert)] = await alerts_of(session, aircraft)
    assert code == "R1"
    assert alert.episode_ended_at is None

    later = NOW + timedelta(seconds=60)
    await save(session, replace(state(aircraft, 0), last_contact_at=later, position_at=later))
    await RulesEngine(session).evaluate(later)

    await session.refresh(alert)
    assert alert.episode_ended_at == later


async def test_an_aircraft_silent_for_too_long_is_not_evaluated(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    await save(session, state(aircraft, 3600))

    await RulesEngine(session).evaluate(NOW)

    assert await alerts_of(session, aircraft) == []


async def test_a_raised_threshold_applies_at_the_next_evaluation(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    await save(session, state(aircraft, 420))
    r1 = await session.scalar(select(Rule).where(Rule.code == "R1"))
    r1.threshold = Decimal("500")
    await session.flush()

    await RulesEngine(session).evaluate(NOW)

    assert await alerts_of(session, aircraft) == []


async def test_the_database_refuses_two_open_episodes(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    await save(session, state(aircraft, 420))
    await RulesEngine(session).evaluate(NOW)
    [(_, alert)] = await alerts_of(session, aircraft)

    session.add(Alert(aircraft_id=alert.aircraft_id, rule_id=alert.rule_id, message="duplicate"))
    with pytest.raises(IntegrityError):
        await session.flush()


async def test_the_episode_of_an_aircraft_that_landed_ends(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    await save(session, state(aircraft, 420))
    await RulesEngine(session).evaluate(NOW)
    [(_, alert)] = await alerts_of(session, aircraft)

    later = NOW + timedelta(seconds=60)
    landed = replace(state(aircraft, 0), last_contact_at=later, position_at=later, on_ground=True)
    await save(session, landed)
    await RulesEngine(session).evaluate(later)

    await session.refresh(alert)
    assert alert.episode_ended_at == later


async def test_the_contacts_of_the_current_collection_are_evaluated(
    session: AsyncSession,
) -> None:
    aircraft = secrets.token_hex(3)
    # Heard 420 s before the collection started, then again 3 s after its start.
    await save(session, state(aircraft, 420), state(aircraft, -3))

    await RulesEngine(session).evaluate(NOW)

    assert await alerts_of(session, aircraft) == []


async def test_r2_reads_the_latest_position_behind_newer_contacts(session: AsyncSession) -> None:
    aircraft = secrets.token_hex(3)
    # Positions 1200 and 900 s ago, then contacts without position.
    without_position = [replace(state(aircraft, ago), position_at=None) for ago in (600, 20)]
    await save(session, state(aircraft, 1200), state(aircraft, 900), *without_position)

    await RulesEngine(session).evaluate(NOW)

    codes = {code: alert for code, alert in await alerts_of(session, aircraft)}
    assert codes["R2"].observed_value == Decimal("900.000")
