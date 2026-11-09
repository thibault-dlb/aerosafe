from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest

from services.collection.flight_grouper import FlightDecision, FlightGrouper, OpenFlight
from services.collection.normalizer import NormalizedState, StateVectorNormalizer

CONTACT = 1_700_000_100
POSITION = 1_700_000_095


def raw_state(**changes: Any) -> list[Any]:
    """A state vector of /states/all, with fields replaced by name."""
    fields: dict[str, Any] = {
        "icao24": "3C6444",
        "callsign": "DLH9LF  ",
        "origin_country": "Germany",
        "time_position": POSITION,
        "last_contact": CONTACT,
        "longitude": 2.5478312,
        "latitude": 49.0097123,
        "baro_altitude": 10972.8,
        "on_ground": False,
        "velocity": 231.456,
        "true_track": 87.125,
        "vertical_rate": 0.0,
        "sensors": None,
        "geo_altitude": 11277.6,
        "squawk": "1000",
        "spi": False,
        "position_source": 0,
    }
    fields.update(changes)
    return list(fields.values())


normalizer = StateVectorNormalizer()


def one(**changes: Any) -> NormalizedState:
    state = normalizer.normalize_one(raw_state(**changes))
    assert state is not None
    return state


def test_a_complete_state_is_cleaned() -> None:
    state = one()

    assert state.icao24 == "3c6444"
    assert state.callsign == "DLH9LF"
    assert state.last_contact_at == datetime.fromtimestamp(CONTACT, UTC)
    assert state.position_at == datetime.fromtimestamp(POSITION, UTC)
    assert (state.latitude, state.longitude) == (49.009712, 2.547831)
    assert state.altitude == Decimal("10972.8")
    assert state.speed == Decimal("231.46")
    assert state.heading == Decimal("87.13")
    assert state.on_ground is False
    assert state.has_position


@pytest.mark.parametrize(
    "changes",
    [
        {"icao24": "zzzzzz"},
        {"icao24": "3c64"},
        {"icao24": None},
        {"last_contact": None},
        {"last_contact": "soon"},
        {"last_contact": True},
        {"last_contact": 0},
    ],
)
def test_a_state_without_aircraft_or_contact_is_rejected(changes: dict[str, Any]) -> None:
    assert normalizer.normalize_one(raw_state(**changes)) is None


def test_a_short_vector_is_rejected() -> None:
    assert normalizer.normalize_one(["3c6444"]) is None


def test_the_geometric_altitude_replaces_a_missing_barometric_one() -> None:
    assert one(baro_altitude=None).altitude == Decimal("11277.6")
    assert one(baro_altitude=None, geo_altitude=None).altitude is None


def test_an_altitude_too_large_for_the_column_is_dropped() -> None:
    assert one(baro_altitude=2_000_000.0).altitude is None


@pytest.mark.parametrize(
    ("track", "heading"),
    [(359.996, Decimal("0.00")), (360, Decimal("0.00")), (0, Decimal("0.00"))],
)
def test_a_heading_of_360_becomes_0(track: float, heading: Decimal) -> None:
    assert one(true_track=track).heading == heading


@pytest.mark.parametrize("changes", [{"true_track": -1}, {"true_track": 400}, {"true_track": None}])
def test_an_invalid_heading_is_dropped(changes: dict[str, Any]) -> None:
    assert one(**changes).heading is None


@pytest.mark.parametrize("velocity", [-3.0, 12_000.0, float("nan"), None])
def test_an_invalid_speed_is_dropped(velocity: float | None) -> None:
    assert one(velocity=velocity).speed is None


@pytest.mark.parametrize(
    "changes",
    [
        {"time_position": None},
        {"latitude": None},
        {"longitude": 181.0},
        {"latitude": -91.0},
        {"time_position": CONTACT + 5},
    ],
)
def test_an_unusable_position_is_dropped_whole(changes: dict[str, Any]) -> None:
    state = one(**changes)

    assert (state.latitude, state.longitude, state.position_at) == (None, None, None)
    assert not state.has_position


def test_a_blank_callsign_is_empty() -> None:
    assert one(callsign="        ").callsign is None
    assert one(callsign=None).callsign is None


def test_on_ground_is_true_only_when_opensky_says_so() -> None:
    assert one(on_ground=True).on_ground is True
    assert one(on_ground=None).on_ground is False


def test_a_batch_counts_rejects_and_keeps_the_latest_state_per_aircraft() -> None:
    result = normalizer.normalize(
        [
            raw_state(last_contact=CONTACT),
            raw_state(last_contact=CONTACT + 10),
            raw_state(last_contact=CONTACT + 5),
            raw_state(icao24="4ca7b3"),
            raw_state(icao24="bad"),
        ]
    )

    assert result.rejected == 1
    by_aircraft = {state.icao24: state for state in result.states}
    assert set(by_aircraft) == {"3c6444", "4ca7b3"}
    assert by_aircraft["3c6444"].last_contact_at == datetime.fromtimestamp(CONTACT + 10, UTC)


# Flight grouping (D-06)

grouper = FlightGrouper(timedelta(minutes=30))
SEEN = datetime.fromtimestamp(CONTACT, UTC)


def flight(callsign: str | None = "DLH9LF", last_seen_at: datetime = SEEN) -> OpenFlight:
    return OpenFlight(flight_id=1, callsign=callsign, last_seen_at=last_seen_at)


def test_the_first_observation_starts_a_flight() -> None:
    assert grouper.decide(None, one()) is FlightDecision.NEW


def test_an_observation_within_the_gap_joins_the_flight() -> None:
    state = one(last_contact=CONTACT + 30 * 60)

    assert grouper.decide(flight(), state) is FlightDecision.JOIN


def test_an_observation_after_the_gap_starts_a_flight() -> None:
    state = one(last_contact=CONTACT + 30 * 60 + 1)

    assert grouper.decide(flight(), state) is FlightDecision.NEW


def test_a_new_callsign_starts_a_flight() -> None:
    assert grouper.decide(flight(), one(callsign="DLH9LG")) is FlightDecision.NEW


def test_a_missing_callsign_does_not_split_the_flight() -> None:
    assert grouper.decide(flight(), one(callsign=None)) is FlightDecision.JOIN
    assert grouper.decide(flight(callsign=None), one()) is FlightDecision.JOIN


def test_stale_flights_are_those_older_than_the_gap() -> None:
    now = datetime(2026, 11, 9, 12, tzinfo=UTC)

    assert grouper.stale_before(now) == datetime(2026, 11, 9, 11, 30, tzinfo=UTC)
    assert grouper.max_gap == timedelta(minutes=30)


def test_the_gap_must_be_positive() -> None:
    with pytest.raises(ValueError):
        FlightGrouper(timedelta(0))
