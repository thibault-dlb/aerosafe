"""In-memory doubles for the replay tests."""

from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

from services.replay.clock import ReplayBounds, ReplayState

START = datetime(2022, 8, 1, tzinfo=UTC)
END = datetime(2022, 8, 31, 23, 59, 59, tzinfo=UTC)
BOUNDS = ReplayBounds(START, END)
T0 = datetime(2022, 8, 14, 15, 0, tzinfo=UTC)
REAL = datetime(2026, 11, 13, 10, 0, tzinfo=UTC)


def seconds(count: float) -> timedelta:
    return timedelta(seconds=count)


class MemoryReplayStore:
    """A store that keeps the state in memory and records what the service asked."""

    def __init__(self, state: ReplayState | None = None, bounds: ReplayBounds | None = BOUNDS):
        self._state = state or ReplayState()
        self._bounds = bounds
        self.bounds_reads = 0
        self.saved: list[ReplayState] = []
        self.resets: list[datetime] = []

    async def state(self) -> ReplayState:
        return self._state

    async def save(self, state: ReplayState) -> None:
        self._state = state
        self.saved.append(state)

    async def bounds(self) -> ReplayBounds | None:
        self.bounds_reads += 1
        return self._bounds

    async def restart(self, state: ReplayState) -> None:
        # The real store cleans the alerts and writes the state in one transaction.
        assert state.simulated_at is not None
        self.resets.append(state.simulated_at)
        await self.save(state)

    def mark_evaluated(self, until: datetime) -> None:
        self._state = replace(self._state, evaluated_until=until)


class Clock:
    """A real time that the test moves by hand."""

    def __init__(self, moment: datetime = REAL) -> None:
        self.moment = moment

    def __call__(self) -> datetime:
        return self.moment

    def advance(self, by: timedelta) -> None:
        self.moment += by


class FakeScalars:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def one(self) -> Any:
        return self._rows[0]


class FakeSession:
    """Answers the store from queues and records what it was asked."""

    def __init__(
        self, parameter: Any = None, rows: list[tuple] | None = None, rowcount: int = 0
    ) -> None:
        self.parameter = parameter
        self.rows = rows or []
        self.executed: list[Any] = []
        self.commits = 0

    async def scalars(self, statement: Any) -> FakeScalars:
        self.executed.append(statement)
        return FakeScalars([self.parameter])

    async def execute(self, statement: Any) -> SimpleNamespace:
        self.executed.append(statement)
        return SimpleNamespace(one=lambda: self.rows[0], all=lambda: self.rows)

    async def commit(self) -> None:
        self.commits += 1


def session_factory(session: FakeSession):
    @asynccontextmanager
    async def factory():
        yield session

    return factory
