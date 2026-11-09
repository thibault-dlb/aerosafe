from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class StateSample:
    """One stored observation of an aircraft, reduced to what the rules read.

    Values are in OpenSky units: metres, metres per second and degrees.
    A missing value means OpenSky did not send it.
    """

    last_contact_at: datetime
    position_at: datetime | None
    altitude: float | None
    speed: float | None
    heading: float | None
    on_ground: bool
    flight_id: int | None


@dataclass(frozen=True)
class AircraftSnapshot:
    """What the engine knows about one aircraft at evaluation time.

    `previous` is the observation just before `latest` in the same flight, or empty when
    `latest` belongs to no flight or is the first of its flight (D-06).
    `latest_with_position` is the latest observation that has a position, used by R2.
    """

    aircraft_id: int
    icao24: str
    latest: StateSample
    previous: StateSample | None = None
    latest_with_position: StateSample | None = None

    @property
    def airborne(self) -> bool:
        return not self.latest.on_ground


@dataclass(frozen=True)
class RuleOutcome:
    """Result of one rule for one aircraft: the observed value and whether it triggers."""

    observed_value: float
    triggered: bool
    message: str


class BusinessRule(ABC):
    """A business rule. Each rule is a separate class, so adding one changes no other (NF-06)."""

    code: str
    unit: str
    label: str

    def check(
        self, snapshot: AircraftSnapshot, threshold: float, now: datetime
    ) -> RuleOutcome | None:
        """Evaluate the rule. `None` means it cannot be evaluated for this aircraft now."""
        if not snapshot.airborne:
            return None
        value = self.observe(snapshot, now)
        if value is None:
            return None
        triggered = value > threshold
        return RuleOutcome(
            observed_value=round(value, 3),
            triggered=triggered,
            message=self.message(snapshot, value, threshold, triggered),
        )

    @abstractmethod
    def observe(self, snapshot: AircraftSnapshot, now: datetime) -> float | None:
        """Compute the observed value, or `None` when the data does not allow it."""

    def message(
        self, snapshot: AircraftSnapshot, value: float, threshold: float, triggered: bool
    ) -> str:
        comparison = "above" if triggered else "within"
        return (
            f"{self.code} {self.label} for {snapshot.icao24}: "
            f"{value:.1f} {self.unit} {comparison} the threshold of {threshold:g} {self.unit}"
        )
