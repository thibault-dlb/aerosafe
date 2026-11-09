from datetime import datetime

from services.rules.base import AircraftSnapshot, BusinessRule


class LastContactRule(BusinessRule):
    """R1: too long a delay since the last message received from the aircraft."""

    code = "R1"
    unit = "s"
    label = "delay since the last contact"

    def observe(self, snapshot: AircraftSnapshot, now: datetime) -> float | None:
        return (now - snapshot.latest.last_contact_at).total_seconds()


class StalePositionRule(BusinessRule):
    """R2: the latest known position has become too old.

    It reads the latest observation that has a position, never the latest raw one, since
    OpenSky leaves the position time empty when no position came in the last 15 seconds.
    """

    code = "R2"
    unit = "s"
    label = "age of the latest position"

    def observe(self, snapshot: AircraftSnapshot, now: datetime) -> float | None:
        sample = snapshot.latest_with_position
        if sample is None or sample.position_at is None:
            return None
        return (now - sample.position_at).total_seconds()
