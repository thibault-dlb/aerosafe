from dataclasses import replace
from datetime import UTC, datetime, timedelta

from services.rules.base import AircraftSnapshot, StateSample
from services.rules.delay import LastContactRule, StalePositionRule

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)


def sample(contact_ago: int, position_ago: int | None = None, on_ground: bool = False):
    position_at = None if position_ago is None else NOW - timedelta(seconds=position_ago)
    return StateSample(
        last_contact_at=NOW - timedelta(seconds=contact_ago),
        position_at=position_at,
        altitude=10000.0,
        speed=230.0,
        heading=90.0,
        on_ground=on_ground,
        flight_id=1,
    )


def snapshot(latest: StateSample, with_position: StateSample | None = None) -> AircraftSnapshot:
    return AircraftSnapshot(
        aircraft_id=1, icao24="3c6444", latest=latest, latest_with_position=with_position
    )


class TestLastContactRule:
    rule = LastContactRule()

    def test_triggers_after_a_long_silence(self) -> None:
        outcome = self.rule.check(snapshot(sample(420, 420)), 300, NOW)

        assert outcome is not None
        assert outcome.triggered
        assert outcome.observed_value == 420
        assert outcome.message.startswith("R1 ")
        assert "3c6444" in outcome.message

    def test_does_not_trigger_after_a_recent_contact(self) -> None:
        outcome = self.rule.check(snapshot(sample(60, 60)), 300, NOW)

        assert outcome is not None
        assert not outcome.triggered
        assert outcome.observed_value == 60

    def test_value_equal_to_the_threshold_does_not_trigger(self) -> None:
        outcome = self.rule.check(snapshot(sample(300, 300)), 300, NOW)

        assert outcome is not None
        assert not outcome.triggered

    def test_ignores_an_aircraft_on_the_ground(self) -> None:
        assert self.rule.check(snapshot(sample(420, on_ground=True)), 300, NOW) is None

    def test_a_contact_after_the_collection_start_counts_as_no_delay(self) -> None:
        outcome = self.rule.check(snapshot(sample(-5, -5)), 300, NOW)

        assert outcome is not None
        assert outcome.observed_value == 0
        assert not outcome.triggered


class TestStalePositionRule:
    rule = StalePositionRule()

    def test_triggers_when_the_position_is_old_but_the_contact_recent(self) -> None:
        latest = sample(20, 900)

        outcome = self.rule.check(snapshot(latest, latest), 600, NOW)

        assert outcome is not None
        assert outcome.triggered
        assert outcome.observed_value == 900

    def test_does_not_trigger_with_a_recent_position(self) -> None:
        latest = sample(120, 120)

        outcome = self.rule.check(snapshot(latest, latest), 600, NOW)

        assert outcome is not None
        assert not outcome.triggered

    def test_falls_back_on_the_latest_observation_with_a_position(self) -> None:
        latest = sample(10)  # No position in the latest message.
        older = sample(40, 700)

        outcome = self.rule.check(snapshot(latest, older), 600, NOW)

        assert outcome is not None
        assert outcome.triggered
        assert outcome.observed_value == 700

    def test_cannot_be_evaluated_without_any_position(self) -> None:
        assert self.rule.check(snapshot(sample(10)), 600, NOW) is None

    def test_cannot_be_evaluated_when_the_sample_has_no_position_time(self) -> None:
        latest = sample(10)
        without_time = replace(latest, position_at=None)

        assert self.rule.check(snapshot(latest, without_time), 600, NOW) is None

    def test_a_position_after_the_collection_start_counts_as_no_delay(self) -> None:
        latest = sample(-5, -5)
        outcome = self.rule.check(snapshot(latest, latest), 600, NOW)

        assert outcome is not None
        assert outcome.observed_value == 0
