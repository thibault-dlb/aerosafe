import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
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


class HistoricalImportError(RuntimeError):
    """The database does not hold what the file holds: the file must not be deleted."""


class ObservationSink(Protocol):
    """What the importer needs from the database; `HistoricalStore` is the real one."""

    async def has_observations_outside(self, start: datetime, end: datetime) -> bool: ...

    async def ensure_aircraft(self, icao24s: Sequence[str]) -> dict[str, int]: ...

    async def ensure_flights(self, flights: Sequence[NewFlight]) -> dict[tuple[int, int], int]: ...

    async def count_observations(self, aircraft_ids: Sequence[int]) -> int: ...

    async def insert_observations(self, batch: ObservationBatch) -> int: ...


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

    Every aircraft of the dataset is one flight, so the observations of the aircraft of a file
    are exactly the points of that file. That is how the importer checks its work: after the
    insert, the database must hold as many observations for those aircraft as the file holds
    points. The check is also what makes a second run of the same file cost almost nothing.
    """

    def __init__(self, reader: Prc2024Reader, batch_size: int = DEFAULT_BATCH_SIZE) -> None:
        if batch_size <= 0:
            raise ValueError("The batch size must be positive")
        self._reader = reader
        self._batch_size = batch_size

    async def import_file(self, sink: ObservationSink, path: Path) -> FileReport:
        started = time.monotonic()
        points = self._reader.load(path)
        segments = self._reader.segments()

        icao24s = sorted({icao24_from_flight_id(segment.source_id) for segment in segments})
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
                keys.append(
                    FlightKey(
                        segment.source_id,
                        segment.started_us,
                        aircraft_id,
                        flights[(aircraft_id, segment.started_us)],
                    )
                )
            self._reader.attach(keys)
            for batch in self._reader.batches(self._batch_size):
                inserted += await sink.insert_observations(batch)
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
