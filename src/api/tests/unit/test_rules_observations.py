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
        "aircraft_rank": rank,
        "flight_rank": 1 if rank == 1 else 2,
    }
    columns.update(values)
    return SimpleNamespace(**columns)


def result(rows: list) -> MagicMock:
    value = MagicMock()
    value.all.return_value = rows
    return value


def compiled(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


def test_recent_query_ranks_per_aircraft_and_per_flight() -> None:
    sql = compiled(SnapshotReader(AsyncMock()).recent_query(NOW))

    assert "row_number() OVER (PARTITION BY" in sql
    assert '"OBSERVATION"."ID_VOL"' in sql
    assert "deleted_at IS NULL" in sql
    # The contacts of the current collection can be later than its start.
    assert '"DT_DERNIER_CONTACT" <=' not in sql


def test_positioned_query_keeps_one_row_per_aircraft() -> None:
    sql = compiled(SnapshotReader.positioned_query([1, 2]))

    assert "JOIN LATERAL" in sql
    assert "LIMIT" in sql
    assert '"OBSERVATION"."ID_AERONEF" = "AERONEF"."ID"' in sql
    assert '"OBSERVATION"."DT_POSITION" IS NOT NULL' in sql
    assert '"DT_DERNIER_CONTACT" <=' not in sql


async def test_read_builds_one_snapshot_per_aircraft() -> None:
    session = AsyncMock()
    recent = [
        row(1, 10, flight_id=5, rank=1, altitude=Decimal("11200.0")),
        row(1, 40, flight_id=5, rank=2),
        row(1, 900, flight_id=4, rank=3),  # Previous of another flight: not a pair.
        row(2, 20, flight_id=None, rank=1, position_at=None),
    ]
    positioned = [row(1, 10, flight_id=5, rank=1), row(2, 400, flight_id=None, rank=1)]
    session.execute.side_effect = [result(recent), result(positioned)]

    snapshots = {item.aircraft_id: item for item in await SnapshotReader(session).read(NOW)}

    first = snapshots[1]
    assert first.icao24 == "000001"
    assert first.latest.altitude == 11200.0
    assert first.previous is not None
    assert first.previous.last_contact_at == NOW - timedelta(seconds=40)
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
