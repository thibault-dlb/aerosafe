import time
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

from services.replay.clock import ALLOWED_SPEEDS, ReplayBounds, ReplayClock, ReplayState
from services.replay.store import ReplayStore

# The period of the data does not change once imported: it is read again every few minutes.
BOUNDS_TTL_SECONDS = 300.0

# The step between two evaluations of the rules, in simulated time. It matches the shortest
# period of the live collection (Île-de-France, 30 s).
EVALUATION_STEP = timedelta(seconds=30)


class ReplayUnavailable(Exception):
    """No replayed data in the database."""


class ReplayOutOfBounds(ValueError):
    """The chosen instant is outside the period of the replayed data."""


class InvalidSpeed(ValueError):
    """The speed is not one of the allowed ones."""


@dataclass(frozen=True)
class ReplayStatus:
    """What the API tells about the replay. `server_time` lets a client move the clock itself
    between two readings."""

    available: bool
    start: datetime | None
    end: datetime | None
    simulated_at: datetime | None
    speed: int
    paused: bool
    finished: bool
    server_time: datetime
    allowed_speeds: tuple[int, ...] = ALLOWED_SPEEDS


def utc_now() -> datetime:
    return datetime.now(UTC)


class ReplayService:
    """Starts, pauses and reads the replay clock, shared by every user."""

    def __init__(
        self,
        store: ReplayStore,
        now: Callable[[], datetime] = utc_now,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._store = store
        self._now = now
        self._monotonic = monotonic
        self._bounds: ReplayBounds | None = None
        self._bounds_read_at: float | None = None

    async def bounds(self) -> ReplayBounds | None:
        """The period of the data, kept for a few minutes."""
        fresh = (
            self._bounds_read_at is not None
            and self._monotonic() - self._bounds_read_at < BOUNDS_TTL_SECONDS
        )
        if not fresh:
            self._bounds = await self._store.bounds()
            self._bounds_read_at = self._monotonic()
        return self._bounds

    async def simulated_now(self) -> datetime | None:
        """The simulated instant, or None when no replay has started."""
        state = await self._store.state()
        return ReplayClock(state, await self.bounds()).now(self._now())

    async def status(self) -> ReplayStatus:
        state = await self._store.state()
        bounds = await self.bounds()
        real_now = self._now()
        clock = ReplayClock(state, bounds)
        return ReplayStatus(
            available=bounds is not None,
            start=bounds.start if bounds else None,
            end=bounds.end if bounds else None,
            simulated_at=clock.now(real_now),
            speed=state.speed,
            paused=state.paused or clock.finished(real_now),
            finished=clock.finished(real_now),
            server_time=real_now,
        )

    async def start(self, at: datetime, speed: int, user_id: int | None) -> ReplayStatus:
        """Start the replay at `at`, even when one is running: the alerts of the earlier run that
        are dated `at` or later are removed, and the open episodes end."""
        bounds = await self.bounds()
        if bounds is None:
            raise ReplayUnavailable
        self._check_speed(speed)
        if not bounds.contains(at):
            raise ReplayOutOfBounds(f"The replay covers {bounds.start} to {bounds.end}")
        await self._store.reset_alerts(at)
        await self._store.save(
            ReplayState(
                simulated_at=at,
                changed_at=self._now(),
                speed=speed,
                paused=False,
                # The first evaluation is at `at` itself.
                evaluated_until=at - EVALUATION_STEP,
                changed_by_id=user_id,
            )
        )
        return await self.status()

    async def pause(self, user_id: int | None) -> ReplayStatus:
        return await self._change(user_id, paused=True)

    async def resume(self, user_id: int | None) -> ReplayStatus:
        return await self._change(user_id, paused=False)

    async def set_speed(self, speed: int, user_id: int | None) -> ReplayStatus:
        self._check_speed(speed)
        return await self._change(user_id, speed=speed)

    async def _change(
        self, user_id: int | None, *, paused: bool | None = None, speed: int | None = None
    ) -> ReplayStatus:
        """Freeze the simulated time reached so far, then apply the change from there."""
        state = await self._store.state()
        if not state.started:
            raise ReplayUnavailable
        real_now = self._now()
        reached = ReplayClock(state, await self.bounds()).now(real_now)
        await self._store.save(
            replace(
                state,
                simulated_at=reached,
                changed_at=real_now,
                paused=state.paused if paused is None else paused,
                speed=state.speed if speed is None else speed,
                changed_by_id=user_id,
            )
        )
        return await self.status()

    @staticmethod
    def _check_speed(speed: int) -> None:
        if speed not in ALLOWED_SPEEDS:
            raise InvalidSpeed(f"The speed must be one of {ALLOWED_SPEEDS}")
