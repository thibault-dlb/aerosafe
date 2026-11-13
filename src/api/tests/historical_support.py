"""Helpers of the historical import tests: daily parquet files and an in-memory database."""

import asyncio
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import duckdb

from services.historical.importer import ObservationSink
from services.historical.prc2024 import FLIGHT_ID_OFFSET, ObservationBatch
from services.historical.store import NewFlight

DAY = "2022-07-01"
# A flight id that fits in an ICAO24 code: the offset itself gives the code 000000.
FLIGHT = FLIGHT_ID_OFFSET + 1
OTHER_FLIGHT = FLIGHT_ID_OFFSET + 2


@dataclass(frozen=True)
class Point:
    """A row of a daily file, in the units of the dataset (feet, knots, degrees)."""

    flight_id: int = FLIGHT
    at: str = f"{DAY} 10:00:00+00"
    latitude: float = 48.5
    longitude: float = 2.5
    altitude: float | None = 10_000.0
    groundspeed: float | None = 400.0
    track: float | None = 90.0


def write_day(path: Path, points: Sequence[Point]) -> Path:
    """Write a parquet file with the columns of the dataset."""
    connection = duckdb.connect()
    connection.execute(
        'CREATE TABLE day (flight_id BIGINT, icao24 BIGINT, "timestamp" TIMESTAMPTZ, '
        "latitude DOUBLE, longitude DOUBLE, altitude DOUBLE, groundspeed DOUBLE, "
        "track DOUBLE, vertical_rate DOUBLE)"
    )
    connection.executemany(
        "INSERT INTO day VALUES (?, ?, CAST(? AS TIMESTAMPTZ), ?, ?, ?, ?, ?, 0.0)",
        [
            [
                p.flight_id,
                p.flight_id,
                p.at,
                p.latitude,
                p.longitude,
                p.altitude,
                p.groundspeed,
                p.track,
            ]
            for p in points
        ],
    )
    connection.execute(f"COPY day TO '{path.as_posix()}' (FORMAT PARQUET)")
    connection.close()
    return path


class FakeSink(ObservationSink):
    """A database in memory: it keeps what the importer writes and answers the counts."""

    def __init__(self, foreign_data: bool = False) -> None:
        self.foreign_data = foreign_data
        self.aircraft: dict[str, int] = {}
        self.flights: dict[tuple[int, int], int] = {}
        self.new_flights: list[NewFlight] = []
        self.batches: list[ObservationBatch] = []
        self.stored: set[tuple[int, int]] = set()
        self.calls: list[str] = []

    async def has_observations_outside(self, start: datetime, end: datetime) -> bool:
        self.calls.append("has_observations_outside")
        return self.foreign_data

    async def ensure_aircraft(self, icao24s: Sequence[str]) -> dict[str, int]:
        self.calls.append("ensure_aircraft")
        for icao24 in icao24s:
            self.aircraft.setdefault(icao24, 100 + len(self.aircraft))
        return {icao24: self.aircraft[icao24] for icao24 in icao24s}

    async def ensure_flights(self, flights: Sequence[NewFlight]) -> dict[tuple[int, int], int]:
        self.calls.append("ensure_flights")
        for flight in flights:
            key = (flight.aircraft_id, flight.started_us)
            if key not in self.flights:
                self.flights[key] = 500 + len(self.flights)
                self.new_flights.append(flight)
        return {
            (f.aircraft_id, f.started_us): self.flights[(f.aircraft_id, f.started_us)]
            for f in flights
        }

    async def count_observations(self, aircraft_ids: Sequence[int]) -> int:
        self.calls.append("count_observations")
        return sum(1 for aircraft_id, _ in self.stored if aircraft_id in aircraft_ids)

    async def insert_observations(self, batch: ObservationBatch) -> int:
        self.calls.append("insert_observations")
        self.batches.append(batch)
        new = {
            key
            for key in zip(batch.aircraft_ids, batch.observed_us, strict=True)
            if key not in self.stored
        }
        self.stored |= new
        return len(new)


class SlowSink(FakeSink):
    """A database that takes time to insert, so that several batches are in progress at once."""

    async def insert_observations(self, batch: ObservationBatch) -> int:
        await asyncio.sleep(0.01)
        return await super().insert_observations(batch)


class FakeUnitOfWork:
    """Gives the same fake database to every unit, and records the transactions.

    `max_active` is the most units open at the same time: the workers that insert together.
    """

    def __init__(self, sink: FakeSink, log: list[str] | None = None) -> None:
        self.sink = sink
        self.log = log if log is not None else []
        self.active = 0
        self.max_active = 0

    @asynccontextmanager
    async def __call__(self) -> AsyncIterator[FakeSink]:
        self.log.append("begin")
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            yield self.sink
        except BaseException:
            self.log.append("rollback")
            raise
        else:
            self.log.append("commit")
        finally:
            self.active -= 1
