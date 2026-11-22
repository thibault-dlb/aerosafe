from dataclasses import dataclass, replace
from datetime import datetime
from typing import Protocol

from core.data_mode import DataMode


class RunStatus:
    """Stable codes of the collection statuses, the `CD_` codes of `R_STATUT_COLLECTE`."""

    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    RATE_LIMITED = "RATE_LIMITED"
    SKIPPED = "SKIPPED"

    COLLECTED = frozenset({SUCCESS, PARTIAL})


@dataclass(frozen=True)
class CollectionRunResult:
    """One collection cycle of a live source, as recorded for the dashboard."""

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
    source: DataMode = DataMode.OPENSKY

    def with_evaluation_error(self, error: str | None) -> "CollectionRunResult":
        return replace(self, evaluation_error=error)


@dataclass(frozen=True)
class PauseState:
    paused: bool = False
    changed_at: datetime | None = None
    changed_by: int | None = None


class CollectionStateStore(Protocol):
    """Where runs and pauses are kept, for each live source: the database in the application,
    memory in tests. Every method reads or writes one source, OpenSky when none is given."""

    async def record(self, run: CollectionRunResult) -> None: ...

    async def runs(
        self, limit: int, before: datetime | None = None, source: DataMode = DataMode.OPENSKY
    ) -> list[CollectionRunResult]:
        """The latest runs of the source started before `before` (all when None), newest
        first."""

    async def last_success(
        self, source: DataMode = DataMode.OPENSKY
    ) -> CollectionRunResult | None: ...

    async def pause_state(self, source: DataMode = DataMode.OPENSKY) -> PauseState: ...

    async def set_paused(
        self,
        paused: bool,
        at: datetime,
        user_id: int | None,
        source: DataMode = DataMode.OPENSKY,
    ) -> PauseState: ...


class InMemoryCollectionStateStore:
    """Keeps the latest runs of this process; for tests and tools without a database."""

    def __init__(self, capacity: int = 1_000) -> None:
        self._capacity = capacity
        self._runs: list[CollectionRunResult] = []
        self._pauses: dict[DataMode, PauseState] = {}

    async def record(self, run: CollectionRunResult) -> None:
        self._runs.insert(0, run)
        del self._runs[self._capacity :]

    async def runs(
        self, limit: int, before: datetime | None = None, source: DataMode = DataMode.OPENSKY
    ) -> list[CollectionRunResult]:
        older = [
            run
            for run in self._runs
            if run.source is source and (before is None or run.started_at < before)
        ]
        return older[:limit]

    async def last_success(self, source: DataMode = DataMode.OPENSKY) -> CollectionRunResult | None:
        return next(
            (
                run
                for run in self._runs
                if run.source is source and run.status in RunStatus.COLLECTED
            ),
            None,
        )

    async def pause_state(self, source: DataMode = DataMode.OPENSKY) -> PauseState:
        return self._pauses.get(source, PauseState())

    async def set_paused(
        self,
        paused: bool,
        at: datetime,
        user_id: int | None,
        source: DataMode = DataMode.OPENSKY,
    ) -> PauseState:
        self._pauses[source] = PauseState(paused, at, user_id)
        return self._pauses[source]
