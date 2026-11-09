from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from models import Alert, Rule
from services.rules.base import AircraftSnapshot, StateSample
from services.rules.engine import RulesEngine
from services.rules.registry import RuleRegistry

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)


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


async def test_keeps_the_episode_open_when_the_rule_cannot_be_evaluated() -> None:
    open_alert = Alert(aircraft_id=10, rule_id=1, message="R1")
    rules_engine, _ = engine(
        [rule("R1", "300", 1)], [snapshot(10, 30, on_ground=True)], [open_alert]
    )

    report = await rules_engine.evaluate(NOW)

    assert open_alert.episode_ended_at is None
    assert report.closed == 0


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
    session.scalars.assert_awaited_once()
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
