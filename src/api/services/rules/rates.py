from abc import abstractmethod
from datetime import datetime

from services.rules.base import AircraftSnapshot, BusinessRule, StateSample

MIN_GAP_SECONDS = 10.0
MAX_GAP_SECONDS = 300.0


class RateRule(BusinessRule):
    """A rule on the rate of change between the two latest observations of the same flight.

    Rates rather than raw differences, so the same manoeuvre gives the same value whatever
    the gap between observations. Gaps under 10 s amplify noise and gaps over 300 s mix two
    phases of a flight: such pairs are not evaluated.
    """

    def observe(self, snapshot: AircraftSnapshot, now: datetime) -> float | None:
        current, previous = snapshot.latest, snapshot.previous
        if previous is None or current.flight_id is None:
            return None
        if current.flight_id != previous.flight_id:
            return None
        if current.position_at is None or previous.position_at is None:
            return None
        gap = (current.position_at - previous.position_at).total_seconds()
        if not MIN_GAP_SECONDS <= gap <= MAX_GAP_SECONDS:
            return None
        change = self.change(previous, current)
        if change is None:
            return None
        return change / gap

    @abstractmethod
    def change(self, previous: StateSample, current: StateSample) -> float | None:
        """Change of the measured quantity, or `None` when a value is missing.

        Absolute, unless the rule has a direction worth showing (see `AltitudeRateRule`).
        """


class AltitudeRateRule(RateRule):
    """R3: a large change in altitude, as a vertical rate.

    The rate is signed, positive in a climb and negative in a descent, so the alert says which
    way the aircraft went. The rule triggers on its size: a descent of 40 m/s and a climb of
    40 m/s both pass a threshold of 30 m/s.
    """

    code = "R3"
    unit = "m/s"
    label = "vertical rate"

    def change(self, previous: StateSample, current: StateSample) -> float | None:
        if previous.altitude is None or current.altitude is None:
            return None
        return current.altitude - previous.altitude

    def exceeds(self, value: float, threshold: float) -> bool:
        return abs(value) > threshold

    def message(
        self, snapshot: AircraftSnapshot, value: float, threshold: float, triggered: bool
    ) -> str:
        comparison = "beyond" if triggered else "within"
        return (
            f"{self.code} {self.label} for {snapshot.icao24}: "
            f"{value:+.1f} {self.unit} {comparison} the threshold of ±{threshold:g} {self.unit}"
        )


class SpeedRateRule(RateRule):
    """R4: a large change in speed, as an acceleration."""

    code = "R4"
    unit = "m/s²"
    label = "acceleration"

    def change(self, previous: StateSample, current: StateSample) -> float | None:
        if previous.speed is None or current.speed is None:
            return None
        return abs(current.speed - previous.speed)


class HeadingRateRule(RateRule):
    """R5: a large change in heading, as a turn rate.

    The heading is compared through the shortest angle, so 359° to 1° is a 2° change.
    Below 50 m/s the heading reported by OpenSky is too noisy, so the rule is not evaluated.
    """

    code = "R5"
    unit = "°/s"
    label = "turn rate"
    min_speed = 50.0

    def change(self, previous: StateSample, current: StateSample) -> float | None:
        if previous.heading is None or current.heading is None:
            return None
        if current.speed is None or current.speed <= self.min_speed:
            return None
        return self.shortest_angle(previous.heading, current.heading)

    @staticmethod
    def shortest_angle(first: float, second: float) -> float:
        """Smallest angle between two headings, from 0 to 180 degrees."""
        difference = abs(second - first) % 360
        return min(difference, 360 - difference)
