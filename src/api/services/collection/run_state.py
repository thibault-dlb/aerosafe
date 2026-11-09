from dataclasses import dataclass, replace
from datetime import datetime
from typing import Protocol


class RunStatus:
    """Stable codes of the collection statuses (future `R_STATUT_COLLECTE`)."""

    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    RATE_LIMITED = "RATE_LIMITED"
    SKIPPED = "SKIPPED"

    COLLECTED = frozenset({SUCCESS, PARTIAL})


@dataclass(frozen=True)
class CollectionRunResult:
    """One collection cycle, as recorded for the dashboard."""

    started_at: datetime
    ended_at: datetime
    status: str
    profile: str
    received: int = 0
    stored: int = 0
    rejected: int = 0
    remaining_credits: int | None = None
    error: str | None = None
    evaluation_error: str | None = None

    def with_evaluation_error(self, error: str | None) -> "CollectionRunResult":
        return replace(self, evaluation_error=error)


@dataclass(frozen=True)
class PauseState:
    paused: bool = False
    changed_at: datetime | None = None
    changed_by: int | None = None


class CollectionStateStore(Protocol):
    """Where runs and the pause are kept: the database in the application, memory in tests."""

    async def record(self, run: CollectionRunResult) -> None: ...

    async def runs(self, limit: int, offset: int = 0) -> list[CollectionRunResult]: ...

    async def last_success(self) -> CollectionRunResult | None: ...

    async def pause_state(self) -> PauseState: ...

    async def set_paused(self, paused: bool, at: datetime, user_id: int | None) -> PauseState: ...


class InMemoryCollectionStateStore:
    """Keeps the latest runs of this process; for tests and tools without a database."""

    def __init__(self, capacity: int = 1_000) -> None:
        self._capacity = capacity
        self._runs: list[CollectionRunResult] = []
        self._pause = PauseState()

    async def record(self, run: CollectionRunResult) -> None:
        self._runs.insert(0, run)
        del self._runs[self._capacity :]

    async def runs(self, limit: int, offset: int = 0) -> list[CollectionRunResult]:
        return self._runs[offset : offset + limit]

    async def last_success(self) -> CollectionRunResult | None:
        return next((run for run in self._runs if run.status in RunStatus.COLLECTED), None)

    async def pause_state(self) -> PauseState:
        return self._pause

    async def set_paused(self, paused: bool, at: datetime, user_id: int | None) -> PauseState:
        self._pause = PauseState(paused, at, user_id)
        return self._pause
