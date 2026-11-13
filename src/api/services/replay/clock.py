from dataclasses import dataclass
from datetime import datetime, timedelta

# How many simulated seconds go by in one real second. Above 60, the rules engine could no
# longer keep up with the clock on a year of data.
ALLOWED_SPEEDS = (1, 10, 60)


@dataclass(frozen=True)
class ReplayBounds:
    """The period covered by the replayed data."""

    start: datetime
    end: datetime

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment <= self.end


@dataclass(frozen=True)
class ReplayState:
    """What is stored about the replay clock.

    The simulated time is not stored as it goes by: it is `simulated_at` at the real instant
    `changed_at`, and moves with the speed from there. Nothing is written while the clock runs.
    `evaluated_until` is the last simulated instant the rules engine has evaluated.
    """

    simulated_at: datetime | None = None
    changed_at: datetime | None = None
    speed: int = 1
    paused: bool = True
    evaluated_until: datetime | None = None
    changed_by_id: int | None = None

    @property
    def started(self) -> bool:
        return self.simulated_at is not None


class ReplayClock:
    """The simulated time, computed from the stored state and the real time. No I/O."""

    def __init__(self, state: ReplayState, bounds: ReplayBounds | None = None) -> None:
        self._state = state
        self._bounds = bounds

    def now(self, real_now: datetime) -> datetime | None:
        """The simulated instant at the real instant `real_now`, or None before any start.

        The clock stops at the end of the data.
        """
        state = self._state
        if state.simulated_at is None:
            return None
        simulated = state.simulated_at
        if not state.paused and state.changed_at is not None:
            elapsed = max(timedelta(0), real_now - state.changed_at)
            simulated += elapsed * state.speed
        if self._bounds is not None:
            simulated = min(simulated, self._bounds.end)
        return simulated

    def finished(self, real_now: datetime) -> bool:
        """Whether the clock reached the end of the data."""
        simulated = self.now(real_now)
        return simulated is not None and self._bounds is not None and simulated >= self._bounds.end

    def running(self, real_now: datetime) -> bool:
        """Whether the simulated time is moving."""
        return self._state.started and not self._state.paused and not self.finished(real_now)
