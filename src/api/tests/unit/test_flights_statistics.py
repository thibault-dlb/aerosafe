from datetime import UTC, datetime, timedelta

import pytest

from schemas.aircraft import ObservationPoint
from services.flights import MAX_GAP_SECONDS, TrajectoryAnalyser
from services.flights.statistics import great_circle_km

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)


def point(seconds: float, latitude=48.0, longitude=2.0, altitude=10000.0, speed=230.0):
    return ObservationPoint(
        last_contact_at=T0 + timedelta(seconds=seconds),
        latitude=latitude,
        longitude=longitude,
        altitude=altitude,
        speed=speed,
        heading=0.0,
        on_ground=False,
    )


def test_one_degree_of_latitude_is_about_111_km() -> None:
    assert great_circle_km(point(0, 48.0), point(0, 49.0)) == pytest.approx(111.2, abs=0.1)


def test_paris_to_lyon_is_about_392_km() -> None:
    paris, lyon = point(0, 48.8566, 2.3522), point(0, 45.7640, 4.8357)

    assert great_circle_km(paris, lyon) == pytest.approx(392, abs=2)


def test_the_statistics_cover_duration_distance_altitude_and_speed() -> None:
    points = [
        point(0, 48.0, altitude=9000, speed=200),
        point(30, 48.1, altitude=10000, speed=220),
        point(60, 48.2, altitude=11000, speed=240),
    ]

    stats = TrajectoryAnalyser(points).statistics()

    assert stats.observation_count == 3
    assert stats.duration_seconds == 60
    assert stats.distance_km == pytest.approx(22.24, abs=0.01)
    assert (stats.mean_altitude, stats.max_altitude) == (10000, 11000)
    assert (stats.mean_speed, stats.max_speed) == (220, 240)


def test_points_are_sorted_by_time_whatever_their_order() -> None:
    stats = TrajectoryAnalyser([point(60, 48.2), point(0, 48.0), point(30, 48.1)]).statistics()

    assert stats.distance_km == pytest.approx(22.24, abs=0.01)
    assert stats.duration_seconds == 60


def test_a_long_silence_is_a_gap_and_does_not_count_in_the_distance() -> None:
    late = MAX_GAP_SECONDS + 60
    analyser = TrajectoryAnalyser([point(0, 48.0), point(30, 48.1), point(30 + late, 49.0)])

    [gap] = analyser.gaps()

    assert gap.start == T0 + timedelta(seconds=30)
    assert gap.duration_seconds == late
    assert analyser.statistics().distance_km == pytest.approx(11.12, abs=0.01)
    assert analyser.statistics().duration_seconds == 30 + late


def test_a_gap_of_exactly_the_maximum_is_still_joined() -> None:
    assert TrajectoryAnalyser([point(0), point(MAX_GAP_SECONDS)]).gaps() == []


def test_observations_without_position_are_skipped_by_the_trajectory_only() -> None:
    no_position = point(30, latitude=None, longitude=None, altitude=12000)

    stats = TrajectoryAnalyser([point(0, 48.0), no_position, point(60, 48.1)]).statistics()

    assert stats.observation_count == 3
    assert stats.max_altitude == 12000
    assert stats.distance_km == pytest.approx(11.12, abs=0.01)


def test_missing_values_are_left_out_of_the_means() -> None:
    stats = TrajectoryAnalyser([point(0, altitude=None, speed=None), point(30)]).statistics()

    assert stats.mean_altitude == 10000
    assert stats.mean_speed == 230


def test_an_empty_flight_has_neutral_statistics() -> None:
    stats = TrajectoryAnalyser([]).statistics()

    assert stats.observation_count == 0
    assert stats.duration_seconds == 0
    assert stats.distance_km == 0
    assert stats.mean_altitude is None
    assert stats.max_speed is None
