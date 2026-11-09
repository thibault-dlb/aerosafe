from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from services.aircraft import ObservationPeriod, ObservationReader

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
AIRCRAFT_ID = "01JC0000000000000000000001"


def sql(period: ObservationPeriod) -> str:
    statement = ObservationReader(AsyncMock()).history_query(AIRCRAFT_ID, period)
    return str(statement.compile(dialect=postgresql.dialect()))


def point(at: datetime, **values) -> SimpleNamespace:
    columns = {
        "last_contact_at": at,
        "position_at": at,
        "latitude": 48.85,
        "longitude": 2.35,
        "altitude": Decimal("10000.0"),
        "speed": Decimal("230.50"),
        "heading": Decimal("90.00"),
        "on_ground": False,
        "flight_public_id": "01JC0000000000000000000F01",
    }
    columns.update(values)
    return SimpleNamespace(**columns)


def reader_returning(rows: list) -> ObservationReader:
    result = MagicMock()
    result.all.return_value = rows
    session = AsyncMock()
    session.execute.return_value = result
    return ObservationReader(session)


def test_a_period_cannot_end_before_it_starts() -> None:
    with pytest.raises(ValueError):
        ObservationPeriod(start=T0, end=T0 - timedelta(seconds=1))


def test_the_history_reads_the_newest_active_observations_of_the_aircraft() -> None:
    query = sql(ObservationPeriod())

    assert '"AERONEF"."CD_ULID" =' in query
    assert '"OBSERVATION".deleted_at IS NULL' in query
    assert 'ORDER BY "OBSERVATION"."DT_DERNIER_CONTACT" DESC' in query
    assert "LIMIT" in query
    assert 'LEFT OUTER JOIN "VOL"' in query


def test_the_history_applies_both_bounds_of_the_period() -> None:
    query = sql(ObservationPeriod(start=T0, end=T0 + timedelta(hours=1)))

    assert '"OBSERVATION"."DT_DERNIER_CONTACT" >=' in query
    assert '"OBSERVATION"."DT_DERNIER_CONTACT" <=' in query


def test_an_open_period_has_no_bound() -> None:
    query = sql(ObservationPeriod())

    assert '"DT_DERNIER_CONTACT" >=' not in query
    assert '"DT_DERNIER_CONTACT" <=' not in query


async def test_the_history_is_returned_in_chronological_order() -> None:
    newest_first = [point(T0 + timedelta(seconds=30)), point(T0)]

    points = await reader_returning(newest_first).history(AIRCRAFT_ID, ObservationPeriod())

    assert [p.last_contact_at for p in points] == [T0, T0 + timedelta(seconds=30)]


async def test_decimals_become_numbers_and_missing_values_stay_empty() -> None:
    rows = [point(T0, altitude=None, speed=None, heading=None, latitude=None, longitude=None)]
    rows.append(point(T0 + timedelta(seconds=30)))

    empty, full = await reader_returning(rows[::-1]).history(AIRCRAFT_ID, ObservationPeriod())

    assert (empty.altitude, empty.speed, empty.heading, empty.latitude) == (None,) * 4
    assert (full.altitude, full.speed, full.heading) == (10000.0, 230.5, 90.0)
    assert full.flight_id == "01JC0000000000000000000F01"
