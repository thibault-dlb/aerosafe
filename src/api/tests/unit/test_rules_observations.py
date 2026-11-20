from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.dialects import postgresql

from services.rules.observations import SnapshotReader

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)


def row(aircraft_id: int, seconds_ago: int, flight_id: int | None, rank: int, **values):
    at = NOW - timedelta(seconds=seconds_ago)
    columns = {
        "aircraft_id": aircraft_id,
        "icao24": f"{aircraft_id:06x}",
        "flight_id": flight_id,
        "last_contact_at": at,
        "position_at": at,
        "altitude": Decimal("10000.0"),
        "speed": Decimal("230.00"),
        "heading": Decimal("90.00"),
        "on_ground": False,
        "latitude": 48.65,
        "longitude": 2.5,
        "aircraft_rank": rank,
    }
    columns.update(values)
    return SimpleNamespace(**columns)


def result(rows: list) -> MagicMock:
    value = MagicMock()
    value.all.return_value = rows
    return value


def compiled(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


def test_recent_query_takes_the_latest_point_and_one_ten_seconds_back() -> None:
    query = SnapshotReader(AsyncMock()).recent_query(NOW).compile(dialect=postgresql.dialect())
    sql = str(query)

    assert "row_number() OVER (PARTITION BY" in sql
    assert "LEFT OUTER JOIN LATERAL" in sql
    assert '"OBSERVATION"."ID_VOL" = latest."ID_VOL"' in sql
    assert '"OBSERVATION"."DT_DERNIER_CONTACT" <= latest."DT_DERNIER_CONTACT" -' in sql
    assert "deleted_at IS NULL" in sql
    assert timedelta(seconds=10) in query.params.values()
    # The contacts of the current collection can be later than its start.
    assert NOW not in query.params.values()


def test_positioned_query_keeps_one_row_per_aircraft() -> None:
    sql = compiled(SnapshotReader.positioned_query([1, 2]))

    assert "JOIN LATERAL" in sql
    assert "LIMIT" in sql
    assert '"OBSERVATION"."ID_AERONEF" = "AERONEF"."ID"' in sql
    assert '"OBSERVATION"."DT_POSITION" IS NOT NULL' in sql
    assert '"DT_DERNIER_CONTACT" <=' not in sql


def live_row(
    aircraft_id: int, seconds_ago: int, flight_id: int | None, previous_ago: int | None, **values
):
    """A row of the live query: the latest point, and the previous one in `previous_*`."""
    latest = row(aircraft_id, seconds_ago, flight_id, rank=1, **values)
    at = None if previous_ago is None else NOW - timedelta(seconds=previous_ago)
    for name, value in {
        "flight_id": flight_id if at else None,
        "last_contact_at": at,
        "position_at": at,
        "altitude": Decimal("9000.0") if at else None,
        "speed": Decimal("220.00") if at else None,
        "heading": Decimal("80.00") if at else None,
        "on_ground": False if at else None,
        "latitude": 48.6 if at else None,
        "longitude": 2.4 if at else None,
    }.items():
        setattr(latest, f"previous_{name}", value)
    return latest


async def test_read_builds_one_snapshot_per_aircraft() -> None:
    session = AsyncMock()
    recent = [
        live_row(1, 10, flight_id=5, previous_ago=40, altitude=Decimal("11200.0")),
        live_row(2, 20, flight_id=None, previous_ago=None, position_at=None),
    ]
    positioned = [row(1, 10, flight_id=5, rank=1), row(2, 400, flight_id=None, rank=1)]
    session.execute.side_effect = [result(recent), result(positioned)]

    snapshots = {item.aircraft_id: item for item in await SnapshotReader(session).read(NOW)}

    first = snapshots[1]
    assert first.icao24 == "000001"
    assert first.latest.altitude == 11200.0
    assert (first.latest.latitude, first.latest.longitude) == (48.65, 2.5)
    assert first.previous is not None
    assert first.previous.last_contact_at == NOW - timedelta(seconds=40)
    assert (first.previous.altitude, first.previous.latitude) == (9000.0, 48.6)
    assert first.latest_with_position is not None

    second = snapshots[2]
    assert second.previous is None
    assert second.latest.position_at is None
    assert second.latest_with_position is not None
    assert second.latest_with_position.position_at == NOW - timedelta(seconds=400)


async def test_read_without_recent_aircraft_skips_the_second_query() -> None:
    session = AsyncMock()
    session.execute.return_value = result([])

    assert await SnapshotReader(session).read(NOW) == []
    session.execute.assert_awaited_once()


async def test_a_live_aircraft_without_a_point_ten_seconds_back_has_no_previous() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        result([live_row(1, 0, flight_id=5, previous_ago=None)]),
        result([row(1, 0, flight_id=5, rank=1)]),
    ]

    [snapshot] = await SnapshotReader(session).read(NOW)

    assert snapshot.previous is None
