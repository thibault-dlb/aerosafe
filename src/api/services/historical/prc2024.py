"""Reads the daily trajectory files of the PRC Data Challenge 2024 (docs/historical-data.md).

One file holds a day of European air traffic, one point per second. The reader keeps the points
inside an area, converts them to the units of the `OBSERVATION` table, cleans the outliers and
cuts each trajectory into flights. All of it runs in DuckDB, which streams the parquet files, so
a file of a gigabyte never has to fit in Python memory.
"""

from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from types import TracebackType
from typing import Any

import duckdb

from services.collection.profiles import BoundingBox

FEET_TO_METRES = 0.3048
KNOTS_TO_METRES_PER_SECOND = 1852 / 3600

# The dataset covers the year 2022: any observation outside it comes from another source.
DATASET_START = datetime(2022, 1, 1, tzinfo=UTC)
DATASET_END = datetime(2023, 1, 1, tzinfo=UTC)

# The dataset gives each flight an obfuscated integer in place of the ICAO24 address (here, the
# same number as `flight_id`), between 248 750 643 and 258 074 492. Shifted by this offset, it
# fits in the 24 bits of an address, so every flight gets its own six-digit hexadecimal code.
FLIGHT_ID_OFFSET = 248_000_000
ICAO24_ADDRESSES = 1 << 24


def icao24_from_flight_id(flight_id: int) -> str:
    """The synthetic ICAO24 code of an anonymous aircraft: one per flight of the dataset.

    The codes are not real addresses, so they must never share a database with real ones.
    """
    address = flight_id - FLIGHT_ID_OFFSET
    if not 0 <= address < ICAO24_ADDRESSES:
        raise ValueError(
            f"Flight {flight_id} does not fit in an ICAO24 code: it must be from "
            f"{FLIGHT_ID_OFFSET} to {FLIGHT_ID_OFFSET + ICAO24_ADDRESSES - 1}"
        )
    return f"{address:06x}"


@dataclass(frozen=True)
class CleaningRules:
    """What makes a measure of the dataset unusable.

    A measure outside these limits becomes empty and the point is kept, as the collector does
    with OpenSky: the rules of the engine skip a missing value. The limits come from the day
    2022-07-01 (docs/historical-data.md), where altitudes above 60 000 ft, speeds above 700 kt
    and aircraft flying below 40 kt at altitude were glitches.
    """

    min_altitude_ft: float = -500.0
    max_altitude_ft: float = 60_000.0
    max_speed_kt: float = 700.0
    # The dataset has no `on_ground` field. A point is on the ground when it is slow and low.
    ground_speed_kt: float = 40.0
    ground_altitude_ft: float = 3_000.0
    # Maximum gap between two points of the same flight (D-06, COLLECTION_FLIGHT_GAP_MINUTES).
    flight_gap: timedelta = timedelta(minutes=30)

    def __post_init__(self) -> None:
        if self.min_altitude_ft >= self.max_altitude_ft:
            raise ValueError("The minimum altitude must be below the maximum altitude")
        if self.max_speed_kt <= 0 or self.ground_speed_kt <= 0:
            raise ValueError("The speeds must be positive")
        if self.flight_gap <= timedelta(0):
            raise ValueError("The flight gap must be positive")


@dataclass(frozen=True)
class Segment:
    """A flight of one aircraft inside the area: its points are at most one gap apart.

    `source_id` is the flight identifier of the dataset, not a database key.
    """

    source_id: int
    started_us: int
    ended_us: int
    points: int


@dataclass(frozen=True)
class ObservationBatch:
    """Observations in columns, ready to be sent to PostgreSQL as arrays.

    Times are microseconds since the epoch, so no time zone conversion is ever needed.
    """

    aircraft_ids: list[int]
    flight_ids: list[int]
    observed_us: list[int]
    longitudes: list[float]
    latitudes: list[float]
    altitudes: list[float | None]
    speeds: list[float | None]
    headings: list[float | None]
    on_grounds: list[bool]

    def __len__(self) -> int:
        return len(self.observed_us)

    @classmethod
    def from_rows(cls, rows: Sequence[tuple[Any, ...]]) -> "ObservationBatch":
        columns = [list(column) for column in zip(*rows, strict=True)]
        return cls(*columns)


@dataclass(frozen=True)
class FlightKey:
    """The database keys of one segment, to hand back to the reader."""

    source_id: int
    started_us: int
    aircraft_id: int
    flight_id: int


# Every query lists its columns: the conventions forbid `SELECT *`.
_LOAD_SQL = """
CREATE OR REPLACE TEMP TABLE clean AS
WITH located AS (
    SELECT flight_id,
           CAST("timestamp" AS TIMESTAMPTZ) AS observed_at,
           latitude, longitude, altitude, groundspeed, track
    FROM read_parquet($path)
    WHERE flight_id IS NOT NULL
      AND "timestamp" IS NOT NULL
      AND latitude BETWEEN $lat_min AND $lat_max
      AND longitude BETWEEN $lon_min AND $lon_max
),
unique_points AS (
    SELECT flight_id, observed_at, latitude, longitude, altitude, groundspeed, track
    FROM located
    QUALIFY ROW_NUMBER() OVER (PARTITION BY flight_id, observed_at ORDER BY observed_at) = 1
),
flagged AS (
    SELECT flight_id, observed_at, latitude, longitude, altitude, groundspeed, track,
           COALESCE(groundspeed < $ground_speed AND altitude < $ground_altitude, FALSE)
               AS on_ground,
           CASE WHEN epoch(observed_at) - epoch(LAG(observed_at) OVER trajectory) > $gap_seconds
                THEN 1 ELSE 0 END AS starts_segment
    FROM unique_points
    WINDOW trajectory AS (PARTITION BY flight_id ORDER BY observed_at)
),
numbered AS (
    SELECT flight_id, observed_at, latitude, longitude, altitude, groundspeed, track, on_ground,
           SUM(starts_segment) OVER (PARTITION BY flight_id ORDER BY observed_at) AS segment_no
    FROM flagged
)
SELECT flight_id AS source_id,
       epoch_us(observed_at) AS observed_us,
       epoch_us(MIN(observed_at) OVER (PARTITION BY flight_id, segment_no)) AS segment_start_us,
       ROUND(longitude, 6) AS longitude,
       ROUND(latitude, 6) AS latitude,
       CASE WHEN altitude BETWEEN $min_altitude AND $max_altitude
            THEN ROUND(altitude * $feet, 1) END AS altitude,
       CASE WHEN groundspeed < 0 OR groundspeed > $max_speed THEN NULL
            WHEN NOT on_ground AND groundspeed < $ground_speed THEN NULL
            ELSE ROUND(groundspeed * $knots, 2) END AS speed,
       CASE WHEN track >= 0 AND track <= 360
            THEN CASE WHEN ROUND(track, 2) >= 360 THEN 0.0 ELSE ROUND(track, 2) END END
           AS heading,
       on_ground
FROM numbered
"""

_SEGMENTS_SQL = """
SELECT source_id, segment_start_us, MAX(observed_us) AS segment_end_us, COUNT(*) AS points
FROM clean
GROUP BY source_id, segment_start_us
ORDER BY source_id, segment_start_us
"""

_BATCH_SQL = """
SELECT k.aircraft_id, k.flight_id, c.observed_us, c.longitude, c.latitude, c.altitude, c.speed,
       c.heading, c.on_ground
FROM clean AS c
JOIN flight_keys AS k ON k.source_id = c.source_id AND k.started_us = c.segment_start_us
ORDER BY c.source_id, c.observed_us
"""


class Prc2024Reader:
    """Loads one daily file at a time and serves its points inside the area.

    Usage for a file: `load`, then `segments` to create the flights, `attach` to say which
    database keys they got, then `batches` to read the observations.
    """

    def __init__(self, area: BoundingBox, rules: CleaningRules | None = None) -> None:
        self._area = area
        self._rules = rules or CleaningRules()
        self._connection = duckdb.connect()

    def load(self, path: Path) -> int:
        """Read, clip and clean a file; return the number of points kept."""
        rules = self._rules
        self._connection.execute(
            _LOAD_SQL,
            {
                "path": str(path),
                "lat_min": self._area.lat_min,
                "lat_max": self._area.lat_max,
                "lon_min": self._area.lon_min,
                "lon_max": self._area.lon_max,
                "ground_speed": rules.ground_speed_kt,
                "ground_altitude": rules.ground_altitude_ft,
                "gap_seconds": rules.flight_gap.total_seconds(),
                "min_altitude": rules.min_altitude_ft,
                "max_altitude": rules.max_altitude_ft,
                "max_speed": rules.max_speed_kt,
                "feet": FEET_TO_METRES,
                "knots": KNOTS_TO_METRES_PER_SECOND,
            },
        )
        self._connection.execute(
            "CREATE OR REPLACE TEMP TABLE flight_keys "
            "(source_id BIGINT, started_us BIGINT, aircraft_id BIGINT, flight_id BIGINT)"
        )
        row = self._connection.execute("SELECT COUNT(*) FROM clean").fetchone()
        return int(row[0]) if row else 0

    def segments(self) -> list[Segment]:
        rows = self._connection.execute(_SEGMENTS_SQL).fetchall()
        return [Segment(*row) for row in rows]

    def attach(self, keys: Iterable[FlightKey]) -> None:
        """Tell the reader which aircraft and flight rows each segment became."""
        rows = [[key.source_id, key.started_us, key.aircraft_id, key.flight_id] for key in keys]
        if rows:  # DuckDB refuses an empty list of parameter sets.
            self._connection.executemany(
                "INSERT INTO flight_keys (source_id, started_us, aircraft_id, flight_id) "
                "VALUES (?, ?, ?, ?)",
                rows,
            )

    def batches(self, size: int) -> Iterator[ObservationBatch]:
        """The observations, flight after flight and in time order, `size` rows at a time."""
        if size <= 0:
            raise ValueError("The batch size must be positive")
        # The temporary tables belong to this connection, not to a cursor taken from it.
        self._connection.execute(_BATCH_SQL)
        while rows := self._connection.fetchmany(size):
            yield ObservationBatch.from_rows(rows)

    def close(self) -> None:
        self._connection.close()

    def __enter__(self) -> "Prc2024Reader":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()


class Prc2024Archive:
    """The folder of the dataset: one `YYYY-MM-DD.parquet` file per day."""

    def __init__(self, folder: Path) -> None:
        if not folder.is_dir():
            raise FileNotFoundError(f"{folder} is not a folder")
        self._folder = folder

    def day_files(self, first: date | None = None, last: date | None = None) -> list[Path]:
        """The daily files between two days, both included, oldest first.

        `flight_list.csv`, the README and anything else that is not a day are ignored.
        """
        files: list[tuple[date, Path]] = []
        for path in self._folder.glob("*.parquet"):
            try:
                day = date.fromisoformat(path.stem)
            except ValueError:
                continue
            if (first is None or day >= first) and (last is None or day <= last):
                files.append((day, path))
        return [path for _, path in sorted(files)]
