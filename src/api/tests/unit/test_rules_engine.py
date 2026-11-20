from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from models import Alert, Rule
from services.rules.base import AircraftSnapshot, StateSample
from services.rules.engine import RulesEngine
from services.rules.registry import RuleRegistry

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)
HOUR = timedelta(hours=1)


def rule(code: str, threshold: str, rule_id: int, criticality_id: int | None = 2) -> Rule:
    return Rule(
        id=rule_id,
        code=code,
        description=code,
        threshold=Decimal(threshold),
        unit_id=1,
        criticality_id=criticality_id,
        is_active=True,
    )


def snapshot(aircraft_id: int, contact_ago: int, on_ground: bool = False) -> AircraftSnapshot:
    at = NOW - timedelta(seconds=contact_ago)
    sample = StateSample(
        last_contact_at=at,
        position_at=at,
        altitude=10000.0,
        speed=230.0,
        heading=90.0,
        on_ground=on_ground,
        flight_id=1,
    )
    return AircraftSnapshot(
        aircraft_id=aircraft_id,
        icao24=f"{aircraft_id:06x}",
        latest=sample,
        latest_with_position=sample,
    )


def scalars(items: list) -> MagicMock:
    result = MagicMock()
    result.all.return_value = items
    return result


def engine(rules: list[Rule], snapshots: list, open_alerts: list | None = None):
    session = MagicMock()
    session.scalars = AsyncMock(side_effect=[scalars(rules), scalars(open_alerts or [])])
    session.flush = AsyncMock()
    reader = MagicMock()
    reader.read = AsyncMock(return_value=snapshots)
    return RulesEngine(session, reader=reader), session


def added_alerts(session: MagicMock) -> list[Alert]:
    return [call.args[0] for call in session.add.call_args_list]


async def test_creates_an_alert_when_a_rule_triggers() -> None:
    rules = [rule("R1", "300", rule_id=1)]
    rules_engine, session = engine(rules, [snapshot(10, 420), snapshot(11, 30)])

    report = await rules_engine.evaluate(NOW)

    [alert] = added_alerts(session)
    assert alert.aircraft_id == 10
    assert alert.rule_id == 1
    assert alert.triggered_at == NOW
    assert alert.observed_value == Decimal("420.0")
    assert alert.threshold == Decimal("300")
    assert alert.criticality_id == 2
    assert alert.message.startswith("R1 ")
    assert alert.episode_ended_at is None
    assert report.created == 1
    assert report.aircraft == 2
    session.flush.assert_awaited_once()


async def test_does_not_repeat_an_alert_while_the_episode_lasts() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=1, message="R1")
    rules_engine, session = engine([rule("R1", "300", 1)], [snapshot(10, 420)], [open_alert])

    report = await rules_engine.evaluate(NOW)

    session.add.assert_not_called()
    assert open_alert.episode_ended_at is None
    assert report.created == 0


async def test_ends_the_episode_when_the_value_is_back_under_the_threshold() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=1, message="R1")
    rules_engine, session = engine([rule("R1", "300", 1)], [snapshot(10, 30)], [open_alert])

    report = await rules_engine.evaluate(NOW)

    assert open_alert.episode_ended_at == NOW
    assert report.closed == 1
    session.add.assert_not_called()


async def test_keeps_the_episode_open_when_an_airborne_aircraft_lacks_data() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=2, message="R2")
    without_position = replace(snapshot(10, 30), latest_with_position=None)
    rules_engine, _ = engine([rule("R2", "600", 2)], [without_position], [open_alert])

    report = await rules_engine.evaluate(NOW)

    assert open_alert.episode_ended_at is None
    assert report.closed == 0


async def test_ends_the_episode_of_an_aircraft_on_the_ground() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=1, message="R1", triggered_at=NOW - HOUR)
    rules_engine, session = engine(
        [rule("R1", "300", 1)], [snapshot(10, 30, on_ground=True)], [open_alert]
    )

    report = await rules_engine.evaluate(NOW)

    assert open_alert.episode_ended_at == NOW
    assert report.closed == 1
    session.flush.assert_awaited_once()


async def test_ends_the_episode_of_an_aircraft_no_longer_heard() -> None:
    silent = Alert(aircraft_id=10, rule_id=1, message="R1", triggered_at=NOW - HOUR)
    rules_engine, session = engine([rule("R1", "300", 1)], [], [silent])

    report = await rules_engine.evaluate(NOW)

    assert silent.episode_ended_at == NOW
    assert report.closed == 1
    session.flush.assert_awaited_once()


async def test_ends_the_episodes_of_a_disabled_rule() -> None:
    disabled = Alert(aircraft_id=10, rule_id=3, message="R3", triggered_at=NOW - HOUR)
    rules_engine, session = engine([rule("R1", "300", 1)], [snapshot(10, 420)], [disabled])

    report = await rules_engine.evaluate(NOW)

    assert disabled.episode_ended_at == NOW
    assert report.closed == 1
    [alert] = added_alerts(session)
    assert alert.rule_id == 1


async def test_ends_every_episode_without_active_rule() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=1, message="R1", triggered_at=NOW - HOUR)
    rules_engine, session = engine([], [snapshot(10, 420)], [open_alert])

    report = await rules_engine.evaluate(NOW)

    assert open_alert.episode_ended_at == NOW
    assert report.closed == 1
    session.flush.assert_awaited_once()


async def test_an_episode_never_ends_before_its_trigger() -> None:
    later = Alert(aircraft_id=10, rule_id=1, message="R1", triggered_at=NOW + HOUR)
    rules_engine, _ = engine([rule("R1", "300", 1)], [], [later])

    await rules_engine.evaluate(NOW)

    assert later.episode_ended_at == NOW + HOUR


async def test_an_episode_of_one_rule_does_not_block_another_rule() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=1, message="R1")
    rules = [rule("R1", "300", 1), rule("R2", "600", 2, criticality_id=None)]
    position_old = snapshot(10, 900)
    rules_engine, session = engine(rules, [position_old], [open_alert])

    await rules_engine.evaluate(NOW)

    [alert] = added_alerts(session)
    assert alert.rule_id == 2
    assert alert.criticality_id is None


async def test_uses_the_threshold_stored_in_the_database() -> None:
    rules_engine, session = engine([rule("R1", "500", 1)], [snapshot(10, 420)])

    await rules_engine.evaluate(NOW)

    session.add.assert_not_called()


async def test_skips_a_rule_without_implementation() -> None:
    rules_engine, session = engine([rule("R9", "1", 9)], [snapshot(10, 420)])

    report = await rules_engine.evaluate(NOW)

    assert report.rules == 0
    session.add.assert_not_called()


async def test_stops_early_without_active_rule() -> None:
    rules_engine, session = engine([], [snapshot(10, 420)])

    report = await rules_engine.evaluate(NOW)

    assert report.rules == 0
    assert session.scalars.await_count == 2
    session.flush.assert_not_called()


async def test_stops_early_without_aircraft() -> None:
    rules_engine, session = engine([rule("R1", "300", 1)], [])

    report = await rules_engine.evaluate(NOW)

    assert report.aircraft == 0
    assert report.rules == 1
    session.flush.assert_not_called()


def test_the_registry_knows_r1_to_r5() -> None:
    assert RuleRegistry().codes == ["R1", "R2", "R3", "R4", "R5"]
    assert RuleRegistry().get("R9") is None


class Strip:
    """An area whose edge is the meridian 0: the distance is the longitude, in km."""

    def distance_to_edge_km(self, latitude: float, longitude: float) -> float:
        return longitude


def placed(aircraft_id: int, contact_ago: int, longitude: float | None) -> AircraftSnapshot:
    located = snapshot(aircraft_id, contact_ago)
    sample = replace(located.latest, latitude=48.0, longitude=longitude)
    return replace(located, latest=sample, latest_with_position=sample)


async def test_an_aircraft_last_placed_near_the_edge_raises_no_r1() -> None:
    snapshots = [placed(10, 420, longitude=19.9), placed(11, 420, longitude=20.0)]
    rules_engine, session = engine([rule("R1", "300", 1)], snapshots)

    await rules_engine.evaluate(NOW, area=Strip())

    assert [alert.aircraft_id for alert in added_alerts(session)] == [11]


async def test_the_edge_margin_can_be_set() -> None:
    session = MagicMock()
    session.scalars = AsyncMock(side_effect=[scalars([rule("R1", "300", 1)]), scalars([])])
    session.flush = AsyncMock()
    reader = MagicMock()
    reader.read = AsyncMock(return_value=[placed(10, 420, longitude=19.9)])

    await RulesEngine(session, reader=reader, edge_margin_km=5).evaluate(NOW, area=Strip())

    assert len(added_alerts(session)) == 1


async def test_an_aircraft_without_position_is_never_near_the_edge() -> None:
    rules_engine, session = engine([rule("R1", "300", 1)], [placed(10, 420, longitude=None)])

    await rules_engine.evaluate(NOW, area=Strip())

    assert len(added_alerts(session)) == 1


async def test_without_area_nothing_is_near_the_edge() -> None:
    rules_engine, session = engine([rule("R1", "300", 1)], [placed(10, 420, longitude=1.0)])

    await rules_engine.evaluate(NOW)

    assert len(added_alerts(session)) == 1
