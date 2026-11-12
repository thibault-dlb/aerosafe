"""HistoricalStore against a real PostgreSQL with the migrations applied.

Uses the session fixture of tests/integration/conftest.py, rolled back after each test.
"""

import secrets
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.aircraft import Aircraft
from models.flight import Flight
from models.observation import Observation
from services.historical.prc2024 import DATASET_END, DATASET_START, ObservationBatch
from services.historical.store import HistoricalStore, NewFlight, to_microseconds

pytestmark = pytest.mark.integration

T0 = datetime(2022, 7, 1, 10, tzinfo=UTC)
T0_US = to_microseconds(T0)
SECOND = 1_000_000


def icao24() -> str:
    return secrets.token_hex(3)


def cycled(values: list, size: int) -> list:
    return [values[index % len(values)] for index in range(size)]


def batch(
    aircraft_id: int, flight_id: int, size: int = 3, start_us: int = T0_US
) -> ObservationBatch:
    return ObservationBatch(
        aircraft_ids=[aircraft_id] * size,
        flight_ids=[flight_id] * size,
        observed_us=[start_us + index * SECOND for index in range(size)],
        longitudes=[2.547831] * size,
        latitudes=[49.009712] * size,
        altitudes=cycled([3048.0, None, 3050.5], size),
        speeds=cycled([205.78, None, 0.0], size),
        headings=cycled([123.46, 0.0, None], size),
        on_grounds=[False] * size,
    )


async def aircraft_and_flight(session: AsyncSession) -> tuple[int, int]:
    store = HistoricalStore(session)
    code = icao24()
    aircraft = (await store.ensure_aircraft([code]))[code]
    flights = await store.ensure_flights([NewFlight(aircraft, T0_US, T0_US + 10 * SECOND)])
    return aircraft, flights[(aircraft, T0_US)]


async def test_an_aircraft_is_created_once_and_found_again(session: AsyncSession) -> None:
    store = HistoricalStore(session)
    codes = [icao24(), icao24()]

    first = await store.ensure_aircraft(codes)
    second = await store.ensure_aircraft(codes)

    assert first == second
    assert len(set(first.values())) == 2
    count = await session.scalar(
        select(func.count()).select_from(Aircraft).where(Aircraft.icao24.in_(codes))
    )
    assert count == 2


async def test_a_flight_is_created_once_and_found_again(session: AsyncSession) -> None:
    store = HistoricalStore(session)
    code = icao24()
    aircraft = (await store.ensure_aircraft([code]))[code]
    flights = [
        NewFlight(aircraft, T0_US, T0_US + 60 * SECOND),
        NewFlight(aircraft, T0_US + 3600 * SECOND, T0_US + 3660 * SECOND),
    ]

    first = await store.ensure_flights(flights)
    second = await store.ensure_flights(flights)

    assert first == second
    assert len(set(first.values())) == 2
    stored = list(
        await session.scalars(
            select(Flight).where(Flight.aircraft_id == aircraft).order_by(Flight.started_at)
        )
    )
    assert [f.started_at for f in stored] == [T0, datetime(2022, 7, 1, 11, tzinfo=UTC)]
    assert stored[0].ended_at == datetime(2022, 7, 1, 10, 1, tzinfo=UTC)
    assert stored[0].callsign is None


async def test_a_batch_is_stored_with_its_units_and_its_position(session: AsyncSession) -> None:
    store = HistoricalStore(session)
    aircraft, flight = await aircraft_and_flight(session)

    inserted = await store.insert_observations(batch(aircraft, flight))

    assert inserted == 3
    rows = list(
        await session.scalars(
            select(Observation)
            .where(Observation.aircraft_id == aircraft)
            .order_by(Observation.last_contact_at)
        )
    )
    assert [r.last_contact_at for r in rows] == [
        datetime(2022, 7, 1, 10, 0, s, tzinfo=UTC) for s in range(3)
    ]
    assert [r.position_at for r in rows] == [r.last_contact_at for r in rows]
    assert [r.altitude for r in rows] == [Decimal("3048.0"), None, Decimal("3050.5")]
    assert [r.speed for r in rows] == [Decimal("205.78"), None, Decimal("0.00")]
    assert [r.heading for r in rows] == [Decimal("123.46"), Decimal("0.00"), None]
    assert all(r.on_ground is False and r.flight_id == flight for r in rows)

    srid, longitude, latitude = (
        await session.execute(
            select(
                func.ST_SRID(Observation.position),
                func.ST_X(Observation.position),
                func.ST_Y(Observation.position),
            ).where(Observation.id == rows[0].id)
        )
    ).one()
    assert (srid, round(longitude, 6), round(latitude, 6)) == (4326, 2.547831, 49.009712)


async def test_storing_the_same_batch_twice_adds_nothing(session: AsyncSession) -> None:
    store = HistoricalStore(session)
    aircraft, flight = await aircraft_and_flight(session)
    await store.insert_observations(batch(aircraft, flight))

    again = await store.insert_observations(batch(aircraft, flight))

    assert again == 0
    assert await store.count_observations([aircraft]) == 3


async def test_the_observations_are_counted_per_aircraft(session: AsyncSession) -> None:
    store = HistoricalStore(session)
    first, flight = await aircraft_and_flight(session)
    second, other_flight = await aircraft_and_flight(session)
    await store.insert_observations(batch(first, flight, size=3))
    await store.insert_observations(batch(second, other_flight, size=2))

    assert await store.count_observations([first]) == 3
    assert await store.count_observations([first, second]) == 5
    assert await store.count_observations([]) == 0


async def test_an_observation_outside_the_year_of_the_dataset_is_detected(
    session: AsyncSession,
) -> None:
    store = HistoricalStore(session)
    aircraft, flight = await aircraft_and_flight(session)
    live = to_microseconds(datetime(2026, 11, 9, 10, tzinfo=UTC))
    await store.insert_observations(batch(aircraft, flight, size=1, start_us=live))

    assert await store.has_observations_outside(DATASET_START, DATASET_END) is True
    everything = (datetime(1970, 1, 1, tzinfo=UTC), datetime(2100, 1, 1, tzinfo=UTC))
    assert await store.has_observations_outside(*everything) is False
