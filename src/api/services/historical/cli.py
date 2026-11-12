"""Load the PRC Data Challenge 2024 trajectories into PostgreSQL (docs/historical-data.md).

Only the points inside the area are kept (France by default), at the resolution of the dataset:
one point per second. Each daily file is loaded in its own transaction, so the import can be
stopped and started again at any time.

Usage, from `src/api`, with the DB_HOST and DB_PASS variables of the target database. Start
with `--dry-run`: it reads the files and reports what would be loaded, without a database.
    python -m services.historical.cli ../../data/prc2024 --from 2022-07-01 --to 2022-07-01 --dry-run
    python -m services.historical.cli ../../data/prc2024 --delete-source
"""

import argparse
import asyncio
import time
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from datetime import date
from pathlib import Path
from typing import Any

from services.collection.profiles import BoundingBox
from services.historical.console import ConsoleProgress, format_duration
from services.historical.importer import (
    DEFAULT_BATCH_SIZE,
    FileReport,
    HistoricalImporter,
    ObservationSink,
    Phase,
    Progress,
)
from services.historical.prc2024 import (
    DATASET_END,
    DATASET_START,
    Prc2024Archive,
    Prc2024Reader,
)

# Measured on 2022-07-01: 318 bytes a point in PostgreSQL (142 for the table, 162 for its six
# indexes), 1.1 GB for the 3.7 million points of that day (docs/historical-data.md).
ESTIMATED_BYTES_PER_POINT = 320

EXIT_OK = 0
EXIT_NO_FILE = 1
EXIT_FOREIGN_DATABASE = 2


class DryRunCommand:
    """Reads the files and says what an import would load. Nothing is written anywhere."""

    def __init__(
        self,
        archive: Prc2024Archive,
        reader: Prc2024Reader,
        say: Callable[[str], None] = print,
        progress: ConsoleProgress | None = None,
    ) -> None:
        self._archive = archive
        self._reader = reader
        self._say = say
        self._progress = progress

    def run(self, first: date | None, last: date | None) -> int:
        files = self._archive.day_files(first, last)
        if not files:
            self._say("No daily file to read.")
            return EXIT_NO_FILE
        self._say(
            f"Reading {len(files)} file(s), {files[0].name} to {files[-1].name}. "
            "Nothing is written."
        )
        if self._progress:
            self._progress.begin(len(files))
        started = time.monotonic()
        total = 0
        try:
            for index, path in enumerate(files, start=1):
                if self._progress:
                    self._progress.begin_file(index)
                    self._progress.update(Progress(path, Phase.READING))
                file_started = time.monotonic()
                points = self._reader.load(path)
                flights = len(self._reader.segments())
                total += points
                remaining = (time.monotonic() - started) / index * (len(files) - index)
                self._say(
                    f"[{index}/{len(files)}] {path.name}: {points:,} points in {flights:,} flights "
                    f"({format_duration(time.monotonic() - file_started)}). "
                    f"Remaining: about {format_duration(remaining)}"
                )
        finally:
            if self._progress:
                self._progress.clear()
        self._say(
            f"Dry run: {total:,} points in {len(files)} files, about "
            f"{total * ESTIMATED_BYTES_PER_POINT / 1e9:,.1f} GB in PostgreSQL "
            f"(rough estimate, {ESTIMATED_BYTES_PER_POINT} bytes a point). Nothing was written."
        )
        return EXIT_OK


class ImportCommand:
    """Imports the daily files one after the other and reports the progress."""

    def __init__(
        self,
        archive: Prc2024Archive,
        reader: Prc2024Reader,
        session_factory: Callable[[], AbstractAsyncContextManager[Any]],
        sink_factory: Callable[[Any], ObservationSink],
        batch_size: int = DEFAULT_BATCH_SIZE,
        delete_source: bool = False,
        say: Callable[[str], None] = print,
        progress: ConsoleProgress | None = None,
        target: str = "the database",
    ) -> None:
        self._archive = archive
        self._session_factory = session_factory
        self._sink_factory = sink_factory
        self._importer = HistoricalImporter(
            reader, batch_size, progress.update if progress else None
        )
        self._delete_source = delete_source
        self._say = say
        self._progress = progress
        self._target = target

    async def run(self, first: date | None, last: date | None) -> int:
        files = self._archive.day_files(first, last)
        if not files:
            self._say("No daily file to import.")
            return EXIT_NO_FILE

        self._say(f"Checking that {self._target} only holds the dataset...")
        async with self._session_factory() as session:
            sink = self._sink_factory(session)
            if await sink.has_observations_outside(DATASET_START, DATASET_END):
                self._say(
                    "This database holds observations dated outside 2022. The synthetic aircraft "
                    "codes of the dataset could collide with real ones: import into a database "
                    "of its own."
                )
                return EXIT_FOREIGN_DATABASE

        self._say(
            f"Importing {len(files)} file(s), {files[0].name} to {files[-1].name}, into "
            f"{self._target}."
        )
        if self._delete_source:
            self._say("--delete-source: each file is deleted once it is verified in the database.")
        if self._progress:
            self._progress.begin(len(files))
        started = time.monotonic()
        points_done = 0
        try:
            for index, path in enumerate(files, start=1):
                if self._progress:
                    self._progress.begin_file(index)
                # One transaction per file: all of it is in the database, or none of it.
                async with self._session_factory() as session, session.begin():
                    report = await self._importer.import_file(self._sink_factory(session), path)
                points_done += report.points
                remaining = (time.monotonic() - started) / index * (len(files) - index)
                self._say(self._line(index, len(files), report, remaining))
                if self._delete_source:
                    self._delete(path)
        finally:
            if self._progress:
                self._progress.clear()
        self._say(
            f"Done: {points_done:,} points from {len(files)} files "
            f"in {format_duration(time.monotonic() - started)}. "
            'Run ANALYZE "OBSERVATION" as the table owner before querying the data.'
        )
        return EXIT_OK

    @staticmethod
    def _line(index: int, total: int, report: FileReport, remaining: float) -> str:
        speed = report.points / report.seconds if report.seconds else 0
        state = "already loaded" if report.already_loaded else f"{report.inserted:,} stored"
        return (
            f"[{index}/{total}] {report.path.name}: {report.points:,} points, "
            f"{report.aircraft:,} aircraft, {report.flights:,} flights, {state} "
            f"in {format_duration(report.seconds)} ({speed:,.0f} points/s). "
            f"Remaining: about {format_duration(remaining)}"
        )

    def _delete(self, path: Path) -> None:
        size = path.stat().st_size
        path.unlink()
        self._say(f"Deleted {path.name} ({size / 1e9:.2f} GB freed).")


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path, help="folder holding the YYYY-MM-DD.parquet files")
    parser.add_argument("--from", dest="first", type=date.fromisoformat, metavar="YYYY-MM-DD")
    parser.add_argument("--to", dest="last", type=date.fromisoformat, metavar="YYYY-MM-DD")
    parser.add_argument(
        "--bbox",
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help="area to keep; default: the COLLECTION_BBOX_FRANCE setting",
    )
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--dry-run", action="store_true", help="read the files and report, without a database"
    )
    parser.add_argument(
        "--delete-source",
        action="store_true",
        help="delete each daily file once its points are verified in the database",
    )
    return parser.parse_args(argv)


async def main(arguments: argparse.Namespace) -> int:  # pragma: no cover - needs the database
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from config.database import settings as database_settings
    from config.opensky import settings as opensky_settings
    from services.historical.store import HistoricalStore

    try:
        area = BoundingBox.parse(arguments.bbox or opensky_settings.COLLECTION_BBOX_FRANCE)
        archive = Prc2024Archive(arguments.source)
    except (ValueError, FileNotFoundError) as error:
        raise SystemExit(f"Invalid arguments: {error}") from error
    progress = ConsoleProgress()
    with Prc2024Reader(area) as reader:
        if arguments.dry_run:
            return DryRunCommand(archive, reader, progress.line, progress).run(
                arguments.first, arguments.last
            )

        engine = create_async_engine(database_settings.DATABASE_ASYNC_URL, pool_pre_ping=True)
        try:
            command = ImportCommand(
                archive,
                reader,
                async_sessionmaker(engine, expire_on_commit=False),
                HistoricalStore,
                arguments.batch_size,
                arguments.delete_source,
                say=progress.line,
                progress=progress,
                target=(
                    f"{database_settings.DB_USER}@{database_settings.DB_HOST}:"
                    f"{database_settings.DB_PORT}/{database_settings.DB_NAME}"
                ),
            )
            return await command.run(arguments.first, arguments.last)
        finally:
            await engine.dispose()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(asyncio.run(main(parse_arguments())))
