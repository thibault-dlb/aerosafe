from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from services.collection.normalizer import NormalizedState


@dataclass(frozen=True)
class OpenFlight:
    """The current flight of an aircraft, with the time of its latest observation.

    `flight_id` is None for a flight added in this collection and not inserted yet.
    """

    flight_id: int | None
    callsign: str | None
    last_seen_at: datetime


class FlightDecision(Enum):
    JOIN = "join"
    NEW = "new"


class FlightGrouper:
    """Decides which flight a new observation belongs to (D-06).

    An observation joins the current flight of its aircraft when at most `max_gap` separates
    it from the previous one and the callsign has not changed; otherwise a new flight starts.
    """

    def __init__(self, max_gap: timedelta) -> None:
        if max_gap <= timedelta(0):
            raise ValueError("The flight gap must be positive")
        self._max_gap = max_gap

    @property
    def max_gap(self) -> timedelta:
        return self._max_gap

    def decide(self, current: OpenFlight | None, state: NormalizedState) -> FlightDecision:
        if current is None:
            return FlightDecision.NEW
        if state.last_contact_at - current.last_seen_at > self._max_gap:
            return FlightDecision.NEW
        if current.callsign and state.callsign and current.callsign != state.callsign:
            # A new callsign without a gap: typically a quick turnaround.
            return FlightDecision.NEW
        return FlightDecision.JOIN

    def stale_before(self, now: datetime) -> datetime:
        """Open flights whose latest observation is older than this are closed."""
        return now - self._max_gap
