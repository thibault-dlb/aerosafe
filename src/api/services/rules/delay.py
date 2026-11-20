from datetime import datetime

from services.rules.base import AircraftSnapshot, BusinessRule


def delay_since(moment: datetime, now: datetime) -> float:
    """Seconds from `moment` to `now`. A moment after `now` counts as no delay: the contacts
    of the collection that started at `now` can be a few seconds later than it."""
    return max(0.0, (now - moment).total_seconds())


class LastContactRule(BusinessRule):
    """R1: too long a delay since the last message received from the aircraft.

    Not evaluated when the latest position is near the edge of the area of the source: the
    aircraft has probably left it, which is no loss of contact.
    """

    code = "R1"
    unit = "s"
    label = "delay since the last contact"
    evaluated_in_replay = False

    def observe(self, snapshot: AircraftSnapshot, now: datetime) -> float | None:
        if snapshot.near_edge:
            return None
        return delay_since(snapshot.latest.last_contact_at, now)


class StalePositionRule(BusinessRule):
    """R2: the latest known position has become too old.

    It reads the latest observation that has a position, never the latest raw one, since
    OpenSky leaves the position time empty when no position came in the last 15 seconds. Not
    evaluated near the edge of the area of the source, as R1.
    """

    code = "R2"
    unit = "s"
    label = "age of the latest position"
    evaluated_in_replay = False

    def observe(self, snapshot: AircraftSnapshot, now: datetime) -> float | None:
        sample = snapshot.latest_with_position
        if snapshot.near_edge or sample is None or sample.position_at is None:
            return None
        return delay_since(sample.position_at, now)
