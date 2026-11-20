from datetime import datetime
from decimal import Decimal
from typing import Any

from services.collection.normalizer import NormalizationResult, NormalizedState, StateFields

FEET_TO_METRES = 0.3048
KNOTS_TO_METRES_PER_SECOND = 1_852 / 3_600

# The value of `alt_baro` for an aircraft on the ground.
_GROUND = "ground"


class AdsbFiNormalizer:
    """Cleans the aircraft of an adsb.fi answer (`/v3/lat/.../lon/.../dist/...`) into the same
    states as OpenSky ones, in metres, metres per second and degrees.

    adsb.fi gives ages instead of times: `seen` is the age of the last message and `seen_pos`
    the age of the last position, both relative to `now`. The times are cut to the second, as
    OpenSky gives them.

    The answer lists every aircraft heard in the last minute, so most of them come back in the
    next answer. An aircraft whose message counter (`messages`) has not moved since the previous
    answer sent nothing new: it is left out instead of being stored again. The counters are
    kept in this object, so one normaliser serves one collection.
    """

    def __init__(self) -> None:
        self._messages: dict[str, int] = {}

    def normalize(self, aircraft: list[Any], now: float) -> NormalizationResult:
        states = []
        rejected = unchanged = 0
        messages: dict[str, int] = {}
        for raw in aircraft:
            state = self.normalize_one(raw, now)
            if state is None:
                rejected += 1
                continue
            counter = raw.get("messages")
            if isinstance(counter, int) and not isinstance(counter, bool):
                messages[state.icao24] = counter
                if self._messages.get(state.icao24) == counter:
                    unchanged += 1
                    continue
            states.append(state)
        # Only the aircraft of this answer are remembered, so the counters never pile up.
        self._messages = messages
        return NormalizationResult(StateFields.keep_latest(states), rejected, unchanged)

    def normalize_one(self, raw: Any, now: float) -> NormalizedState | None:
        """One aircraft, or None when its address or the age of its last message is unusable."""
        if not isinstance(raw, dict):
            return None
        # A `~` marks an address that is not an ICAO one (TIS-B, anonymised): refused.
        icao24 = StateFields.icao24(raw.get("hex"))
        last_contact_at = self._time(now, raw.get("seen"))
        if icao24 is None or last_contact_at is None:
            return None

        latitude = StateFields.coordinate(raw.get("lat"), 90)
        longitude = StateFields.coordinate(raw.get("lon"), 180)
        position_at = self._time(now, raw.get("seen_pos"))
        if latitude is None or longitude is None or position_at is None:
            latitude = longitude = position_at = None
        elif position_at > last_contact_at:
            # A position is a message too: only the cut to the second can put it later.
            position_at = last_contact_at

        on_ground = raw.get("alt_baro") == _GROUND
        model_code = StateFields.text(raw.get("t"))
        return NormalizedState(
            icao24=icao24,
            callsign=StateFields.text(raw.get("flight")),
            last_contact_at=last_contact_at,
            position_at=position_at,
            latitude=latitude,
            longitude=longitude,
            altitude=None if on_ground else self._altitude(raw),
            speed=StateFields.speed(self._scaled(raw.get("gs"), KNOTS_TO_METRES_PER_SECOND)),
            heading=StateFields.heading(raw.get("track")),
            on_ground=on_ground,
            registration=StateFields.text(raw.get("r")),
            model_code=model_code.upper() if model_code else None,
            model_label=StateFields.text(raw.get("desc")) if model_code else None,
        )

    @staticmethod
    def _time(now: float, age: Any) -> datetime | None:
        seconds = StateFields.number(age)
        if seconds is None or seconds < 0:
            return None
        return StateFields.timestamp(now - seconds)

    @classmethod
    def _altitude(cls, raw: dict[str, Any]) -> Decimal | None:
        # Barometric first, geometric when it is missing, as for OpenSky.
        return StateFields.altitude(
            cls._scaled(raw.get("alt_baro"), FEET_TO_METRES),
            cls._scaled(raw.get("alt_geom"), FEET_TO_METRES),
        )

    @staticmethod
    def _scaled(value: Any, factor: float) -> float | None:
        number = StateFields.number(value)
        return None if number is None else number * factor
