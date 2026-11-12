import asyncio
import time
from collections.abc import Callable, Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Protocol

from services.historical.prc2024 import (
    FlightKey,
    ObservationBatch,
    Prc2024Reader,
    icao24_from_flight_id,
)
from services.historical.store import NewFlight

DEFAULT_BATCH_SIZE = 50_000
# PostgreSQL runs one process per connection, so each worker is about one core. There is no upper
# limit: the caller chooses it for its machine (the connections must stay under `max_connections`).
DEFAULT_WORKERS = 6


class HistoricalImportError(RuntimeError):
    """The database does not hold what the file holds: the file must not be deleted."""


class ObservationSink(Protocol):
    """What the importer needs from the database; `HistoricalStore` is the real one."""

    async def has_observations_outside(self, start: datetime, end: datetime) -> bool: ...

    async def ensure_aircraft(self, icao24s: Sequence[str]) -> dict[str, int]: ...

    async def ensure_flights(self, flights: Sequence[NewFlight]) -> dict[tuple[int, int], int]: ...

    async def count_observations(self, aircraft_ids: Sequence[int]) -> int: ...

    async def insert_observations(self, batch: ObservationBatch) -> int: ...


# Each call opens a store in its own transaction, committed when the block ends.
UnitOfWork = Callable[[], AbstractAsyncContextManager[ObservationSink]]


class Phase(Enum):
    """The steps of one file, in order. Only the insert has a measurable progress."""

    READING = "reading and cleaning the file"
    PREPARING = "creating the aircraft and the flights"
    INSERTING = "inserting the observations"
    VERIFYING = "checking the database"


@dataclass(frozen=True)
class Progress:
    """Where the import of a file stands: `done` of `total` points once inserting."""

    path: Path
    phase: Phase
    done: int = 0
    total: int = 0


ProgressCallback = Callable[[Progress], None]


@dataclass(frozen=True)
class FileReport:
    """What importing one daily file did."""

    path: Path
    points: int
    aircraft: int
    flights: int
    inserted: int
    already_loaded: bool
    seconds: float


class HistoricalImporter:
    """Imports one daily file: its aircraft, its flights, then its observations.

    The aircraft and the flights are committed first, since the observations refer to them.
    The batches of observations then go through a queue to `workers` tasks, each with its own
    connection and its own transaction per batch, so that PostgreSQL inserts on several cores.

    Nothing makes a file atomic, and nothing needs to: the batches never share a row, a batch
    already stored is skipped, and the importer checks its work. Every aircraft of the dataset
    is one flight, so the observations of the aircraft of a file are exactly the points of that
    file; after the inserts the database must hold as many as the file holds points. A file
    stopped halfway is completed by running it again, and a file already complete costs only
    that count.
    """

    def __init__(
        self,
        reader: Prc2024Reader,
        unit_of_work: UnitOfWork,
        batch_size: int = DEFAULT_BATCH_SIZE,
        workers: int = DEFAULT_WORKERS,
        on_progress: ProgressCallback | None = None,
    ) -> None:
        if batch_size <= 0:
            raise ValueError("The batch size must be positive")
        if workers < 1:
            raise ValueError("There must be at least one worker")
        self._reader = reader
        self._unit_of_work = unit_of_work
        self._batch_size = batch_size
        self._workers = workers
        self._on_progress = on_progress

    def _notify(self, path: Path, phase: Phase, done: int = 0, total: int = 0) -> None:
        if self._on_progress:
            self._on_progress(Progress(path, phase, done, total))

    async def import_file(self, path: Path) -> FileReport:
        started = time.monotonic()
        self._notify(path, Phase.READING)
        # DuckDB works in a thread, so the other files being imported keep going meanwhile.
        points = await asyncio.to_thread(self._reader.load, path)
        segments = self._reader.segments()

        self._notify(path, Phase.PREPARING, total=points)
        icao24s = sorted({icao24_from_flight_id(segment.source_id) for segment in segments})
        async with self._unit_of_work() as sink:
            aircraft = await sink.ensure_aircraft(icao24s)
            aircraft_ids = sorted(aircraft.values())
            flights = await sink.ensure_flights(
                [
                    NewFlight(
                        aircraft[icao24_from_flight_id(segment.source_id)],
                        segment.started_us,
                        segment.ended_us,
                    )
                    for segment in segments
                ]
            )
            stored = await sink.count_observations(aircraft_ids)
        if stored > points:
            raise HistoricalImportError(
                f"{path.name}: the database already holds {stored} observations of its aircraft "
                f"for {points} points; something else wrote them"
            )

        inserted = 0
        already_loaded = stored == points
        if not already_loaded:
            keys = []
            for segment in segments:
                aircraft_id = aircraft[icao24_from_flight_id(segment.source_id)]
                flight_id = flights[(aircraft_id, segment.started_us)]
                keys.append(
                    FlightKey(segment.source_id, segment.started_us, aircraft_id, flight_id)
                )
            self._reader.attach(keys)
            inserted = await self._insert_all(path, points)
            self._notify(path, Phase.VERIFYING, points, points)
            async with self._unit_of_work() as sink:
                stored = await sink.count_observations(aircraft_ids)
            if stored != points:
                raise HistoricalImportError(
                    f"{path.name}: {points} points read but {stored} observations in the database"
                )
        return FileReport(
            path=path,
            points=points,
            aircraft=len(aircraft),
            flights=len(segments),
            inserted=inserted,
            already_loaded=already_loaded,
            seconds=time.monotonic() - started,
        )

    async def _insert_all(self, path: Path, points: int) -> int:
        """Send the batches to the workers; return how many observations were new."""
        queue: asyncio.Queue[ObservationBatch | None] = asyncio.Queue(maxsize=self._workers * 2)
        sent = 0
        inserted = 0

        async def produce() -> None:
            batches = self._reader.batches(self._batch_size)
            # Each batch is read by DuckDB in a thread, one at a time, never blocking the loop.
            while (batch := await asyncio.to_thread(next, batches, None)) is not None:
                await queue.put(batch)
            for _ in range(self._workers):
                await queue.put(None)

        async def consume() -> None:
            nonlocal sent, inserted
            while (batch := await queue.get()) is not None:
                async with self._unit_of_work() as sink:
                    new_rows = await sink.insert_observations(batch)
                # Not `inserted += await ...`: that reads the total before the wait, and two
                # workers finishing together would overwrite each other's count.
                inserted += new_rows
                sent += len(batch)
                self._notify(path, Phase.INSERTING, sent, points)

        self._notify(path, Phase.INSERTING, 0, points)
        try:
            async with asyncio.TaskGroup() as group:
                group.create_task(produce())
                for _ in range(self._workers):
                    group.create_task(consume())
        except ExceptionGroup as failure:
            # The first failure stops the others; report it as it is, not wrapped in a group.
            raise failure.exceptions[0] from failure
        return inserted
