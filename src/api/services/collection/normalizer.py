import math
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

_ICAO24 = re.compile(r"^[0-9a-f]{6}$")

# Indexes of a state vector of /states/all (OpenSky REST API documentation).
_ICAO24_INDEX = 0
_CALLSIGN = 1
_TIME_POSITION = 3
_LAST_CONTACT = 4
_LONGITUDE = 5
_LATITUDE = 6
_BARO_ALTITUDE = 7
_ON_GROUND = 8
_VELOCITY = 9
_TRUE_TRACK = 10
_GEO_ALTITUDE = 13

# Largest values the columns accept: NUMERIC(7, 1) and NUMERIC(6, 2).
_MAX_ALTITUDE = Decimal("999999.9")
_MAX_SPEED = Decimal("9999.99")


@dataclass(frozen=True)
class NormalizedState:
    """A cleaned state vector, ready to be stored as an observation.

    The registration and the model are filled by the sources that send them (adsb.fi); they
    describe the aircraft, not the observation.
    """

    icao24: str
    callsign: str | None
    last_contact_at: datetime
    position_at: datetime | None
    latitude: float | None
    longitude: float | None
    altitude: Decimal | None
    speed: Decimal | None
    heading: Decimal | None
    on_ground: bool
    registration: str | None = None
    model_code: str | None = None
    model_label: str | None = None

    @property
    def has_position(self) -> bool:
        return self.latitude is not None and self.longitude is not None


@dataclass(frozen=True)
class NormalizationResult:
    """The states kept, how many were rejected, and how many were left out because nothing
    changed since the previous answer (adsb.fi only)."""

    states: list[NormalizedState] = field(default_factory=list)
    rejected: int = 0
    unchanged: int = 0


def _at(values: list[Any], index: int) -> Any:
    return values[index] if index < len(values) else None


def _decimal(value: float, places: str) -> Decimal | None:
    """`value` rounded to `places`; None when it has too many digits to be rounded."""
    try:
        return Decimal(str(value)).quantize(Decimal(places), rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None


class StateFields:
    """The cleaning of each field of a state, shared by the normalisers of every source.

    Every method returns None for a value it cannot use: the rules skip missing values.
    """

    @staticmethod
    def number(value: Any) -> float | None:
        """A finite number, or None. Booleans are not numbers here."""
        if isinstance(value, bool) or not isinstance(value, int | float):
            return None
        try:
            number = float(value)
        except OverflowError:  # An integer too large for a float.
            return None
        return number if math.isfinite(number) else None

    @classmethod
    def timestamp(cls, value: Any) -> datetime | None:
        """A Unix time in seconds, cut to the second as OpenSky gives it."""
        seconds = cls.number(value)
        if seconds is None or seconds <= 0:
            return None
        try:
            return datetime.fromtimestamp(int(seconds), tz=UTC)
        except (OverflowError, OSError, ValueError):  # Beyond the years a datetime holds.
            return None

    @staticmethod
    def icao24(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        icao24 = value.strip().lower()
        return icao24 if _ICAO24.match(icao24) else None

    @staticmethod
    def text(value: Any) -> str | None:
        """A trimmed text, None when empty: a callsign, a registration, a model."""
        if not isinstance(value, str):
            return None
        return value.strip() or None

    @classmethod
    def coordinate(cls, value: Any, limit: float) -> float | None:
        number = cls.number(value)
        if number is None or not -limit <= number <= limit:
            return None
        # About 11 cm.
        return round(number, 6)

    @classmethod
    def altitude(cls, *candidates: Any) -> Decimal | None:
        """The first usable altitude, in metres: the barometric one, then the geometric one."""
        for value in candidates:
            number = cls.number(value)
            if number is not None:
                altitude = _decimal(number, "0.1")
                return altitude if altitude is not None and abs(altitude) <= _MAX_ALTITUDE else None
        return None

    @classmethod
    def speed(cls, value: Any) -> Decimal | None:
        number = cls.number(value)
        if number is None or number < 0:
            return None
        speed = _decimal(number, "0.01")
        return speed if speed is not None and speed <= _MAX_SPEED else None

    @classmethod
    def heading(cls, value: Any) -> Decimal | None:
        number = cls.number(value)
        if number is None or not 0 <= number <= 360:
            return None
        heading = _decimal(number, "0.01")
        # 359.996 rounds to 360.00, the same heading as 0.
        return Decimal("0.00") if heading == 360 else heading

    @staticmethod
    def keep_latest(states: Iterable[NormalizedState]) -> list[NormalizedState]:
        """One state per aircraft: the one with the most recent message."""
        latest: dict[str, NormalizedState] = {}
        for state in states:
            current = latest.get(state.icao24)
            if current is None or state.last_contact_at > current.last_contact_at:
                latest[state.icao24] = state
        return list(latest.values())


class StateVectorNormalizer:
    """Cleans and validates OpenSky state vectors (§VII.1).

    A state is rejected only when its aircraft or its last contact time is unusable. Any
    other invalid field becomes empty, and the rules skip missing values.
    """

    def normalize(self, raw_states: list[Any]) -> NormalizationResult:
        states = []
        rejected = 0
        for raw in raw_states:
            state = self.normalize_one(raw)
            if state is None:
                rejected += 1
            else:
                states.append(state)
        # The same aircraft twice in one answer: keep the most recent message.
        return NormalizationResult(StateFields.keep_latest(states), rejected)

    def normalize_one(self, raw: Any) -> NormalizedState | None:
        if not isinstance(raw, list):
            return None
        icao24 = StateFields.icao24(_at(raw, _ICAO24_INDEX))
        last_contact_at = StateFields.timestamp(_at(raw, _LAST_CONTACT))
        if icao24 is None or last_contact_at is None:
            return None

        position_at = StateFields.timestamp(_at(raw, _TIME_POSITION))
        latitude = StateFields.coordinate(_at(raw, _LATITUDE), 90)
        longitude = StateFields.coordinate(_at(raw, _LONGITUDE), 180)
        # A position needs both coordinates and a time no later than the last contact.
        if (
            latitude is None
            or longitude is None
            or position_at is None
            or position_at > last_contact_at
        ):
            latitude = longitude = position_at = None

        return NormalizedState(
            icao24=icao24,
            callsign=StateFields.text(_at(raw, _CALLSIGN)),
            last_contact_at=last_contact_at,
            position_at=position_at,
            latitude=latitude,
            longitude=longitude,
            altitude=StateFields.altitude(_at(raw, _BARO_ALTITUDE), _at(raw, _GEO_ALTITUDE)),
            speed=StateFields.speed(_at(raw, _VELOCITY)),
            heading=StateFields.heading(_at(raw, _TRUE_TRACK)),
            on_ground=_at(raw, _ON_GROUND) is True,
        )
