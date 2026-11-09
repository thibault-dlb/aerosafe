from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from services.rules.base import AircraftSnapshot, StateSample
from services.rules.rates import AltitudeRateRule, HeadingRateRule, SpeedRateRule

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)
BASE = StateSample(
    last_contact_at=NOW - timedelta(seconds=5),
    position_at=NOW - timedelta(seconds=5),
    altitude=10000.0,
    speed=230.0,
    heading=90.0,
    on_ground=False,
    flight_id=7,
)


def pair(gap: int, **current_values) -> AircraftSnapshot:
    """Two observations of the same flight, `gap` seconds apart."""
    previous_time = BASE.position_at - timedelta(seconds=gap)
    previous = replace(BASE, position_at=previous_time, last_contact_at=previous_time)
    return AircraftSnapshot(
        aircraft_id=1,
        icao24="3c6444",
        latest=replace(BASE, **current_values),
        previous=previous,
    )


def with_previous(snapshot: AircraftSnapshot, **values) -> AircraftSnapshot:
    return replace(snapshot, previous=replace(snapshot.previous, **values))


class TestAltitudeRateRule:
    rule = AltitudeRateRule()

    def test_triggers_on_a_steep_climb(self) -> None:
        outcome = self.rule.check(pair(30, altitude=11200.0), 30, NOW)

        assert outcome is not None
        assert outcome.triggered
        assert outcome.observed_value == 40
        assert outcome.message.startswith("R3 ")

    def test_does_not_trigger_on_a_normal_climb(self) -> None:
        outcome = self.rule.check(pair(30, altitude=10300.0), 30, NOW)

        assert outcome is not None
        assert not outcome.triggered
        assert outcome.observed_value == 10

    def test_triggers_on_a_steep_descent(self) -> None:
        outcome = self.rule.check(pair(30, altitude=8800.0), 30, NOW)

        assert outcome is not None
        assert outcome.triggered

    @pytest.mark.parametrize("gap", [5, 600])
    def test_ignores_a_gap_outside_the_window(self, gap: int) -> None:
        assert self.rule.check(pair(gap, altitude=20000.0), 30, NOW) is None

    @pytest.mark.parametrize("gap", [10, 300])
    def test_accepts_the_bounds_of_the_window(self, gap: int) -> None:
        assert self.rule.check(pair(gap, altitude=10000.0), 30, NOW) is not None

    def test_ignores_an_aircraft_on_the_ground(self) -> None:
        assert self.rule.check(pair(30, altitude=11200.0, on_ground=True), 30, NOW) is None

    def test_ignores_a_missing_altitude(self) -> None:
        assert self.rule.check(pair(30, altitude=None), 30, NOW) is None
        assert self.rule.check(with_previous(pair(30), altitude=None), 30, NOW) is None

    def test_needs_a_previous_observation(self) -> None:
        assert self.rule.check(replace(pair(30), previous=None), 30, NOW) is None

    def test_ignores_an_observation_without_flight(self) -> None:
        assert self.rule.check(pair(30, altitude=11200.0, flight_id=None), 30, NOW) is None

    def test_ignores_two_observations_of_different_flights(self) -> None:
        snapshot = with_previous(pair(30, altitude=11200.0), flight_id=8)

        assert self.rule.check(snapshot, 30, NOW) is None

    def test_ignores_an_observation_without_position_time(self) -> None:
        snapshot = with_previous(pair(30, altitude=11200.0), position_at=None)

        assert self.rule.check(snapshot, 30, NOW) is None


class TestSpeedRateRule:
    rule = SpeedRateRule()

    def test_triggers_on_an_abrupt_deceleration(self) -> None:
        snapshot = with_previous(pair(20, speed=170.0), speed=230.0)

        outcome = self.rule.check(snapshot, 2, NOW)

        assert outcome is not None
        assert outcome.triggered
        assert outcome.observed_value == 3

    def test_does_not_trigger_on_a_gentle_change(self) -> None:
        outcome = self.rule.check(pair(30, speed=220.0), 2, NOW)

        assert outcome is not None
        assert not outcome.triggered
        assert outcome.observed_value == pytest.approx(0.333, abs=0.001)

    def test_ignores_a_missing_speed(self) -> None:
        assert self.rule.check(pair(30, speed=None), 2, NOW) is None


class TestHeadingRateRule:
    rule = HeadingRateRule()

    def test_triggers_on_a_sharp_turn(self) -> None:
        snapshot = with_previous(pair(20, heading=200.0, speed=200.0), heading=90.0)

        outcome = self.rule.check(snapshot, 5, NOW)

        assert outcome is not None
        assert outcome.triggered
        assert outcome.observed_value == 5.5

    def test_does_not_trigger_across_north(self) -> None:
        snapshot = with_previous(pair(20, heading=10.0, speed=200.0), heading=350.0)

        outcome = self.rule.check(snapshot, 5, NOW)

        assert outcome is not None
        assert not outcome.triggered
        assert outcome.observed_value == 1

    def test_ignores_a_slow_aircraft(self) -> None:
        snapshot = with_previous(pair(20, heading=200.0, speed=30.0), heading=90.0)

        assert self.rule.check(snapshot, 5, NOW) is None

    def test_ignores_a_missing_heading_or_speed(self) -> None:
        assert self.rule.check(pair(20, heading=None), 5, NOW) is None
        assert self.rule.check(pair(20, speed=None), 5, NOW) is None

    @pytest.mark.parametrize(
        ("first", "second", "expected"),
        [(359.0, 1.0, 2.0), (1.0, 359.0, 2.0), (0.0, 180.0, 180.0), (90.0, 200.0, 110.0)],
    )
    def test_shortest_angle(self, first: float, second: float, expected: float) -> None:
        assert HeadingRateRule.shortest_angle(first, second) == expected
