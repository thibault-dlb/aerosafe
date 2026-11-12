"""Load the PRC Data Challenge 2024 trajectories into PostgreSQL (docs/historical-data.md).

Only the points inside the area are kept, at the resolution of the dataset: one point per
second. The area is a named mask that follows a border (`--area france-100km`: France without
Corsica plus 100 km all around), or a rectangle (`--bbox`, by default the rectangle of the
FRANCE collection profile). Each daily file is loaded in its own transaction, so the import can be
stopped and started again at any time.

Usage, from `src/api`, with the DB_HOST and DB_PASS variables of the target database. Start
with `--dry-run`: it reads the files and reports what would be loaded, without a database.
    python -m services.historical.cli ../../data/prc2024 --from 2022-07-01 --to 2022-07-01 --dry-run
    python -m services.historical.cli ../../data/prc2024 --area france-100km --delete-source
"""

import argparse
import asyncio
import time
from collections.abc import Callable
from datetime import date
from pathlib import Path

from services.collection.profiles import BoundingBox
from services.historical.areas import AREA_NAMES, Area
from services.historical.console import ConsoleProgress, format_duration
from services.historical.importer import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_WORKERS,
    MAX_WORKERS,
    FileReport,
    HistoricalImporter,
    Phase,
    Progress,
    UnitOfWork,
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
        unit_of_work: UnitOfWork,
        batch_size: int = DEFAULT_BATCH_SIZE,
        delete_source: bool = False,
        say: Callable[[str], None] = print,
        progress: ConsoleProgress | None = None,
        target: str = "the database",
        workers: int = DEFAULT_WORKERS,
    ) -> None:
        self._archive = archive
        self._unit_of_work = unit_of_work
        self._importer = HistoricalImporter(
            reader,
            unit_of_work,
            batch_size,
            workers,
            progress.update if progress else None,
        )
        self._workers = workers
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
        async with self._unit_of_work() as sink:
            if await sink.has_observations_outside(DATASET_START, DATASET_END):
                self._say(
                    "This database holds observations dated outside 2022. The synthetic aircraft "
                    "codes of the dataset could collide with real ones: import into a database "
                    "of its own."
                )
                return EXIT_FOREIGN_DATABASE

        self._say(
            f"Importing {len(files)} file(s), {files[0].name} to {files[-1].name}, into "
            f"{self._target}, with {self._workers} insert worker(s)."
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
                report = await self._importer.import_file(path)
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


def workers_count(text: str) -> int:
    """An argument of `--workers`: a whole number from 1 to the maximum."""
    try:
        count = int(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{text!r} is not a number") from None
    if not 1 <= count <= MAX_WORKERS:
        raise argparse.ArgumentTypeError(f"the workers go from 1 to {MAX_WORKERS}, not {count}")
    return count


def choose_area(arguments: argparse.Namespace, default_bbox: str) -> Area:
    """The area to keep: a named mask, the rectangle given, or the default rectangle."""
    if arguments.area:
        return Area.named(arguments.area)
    return Area.rectangle(BoundingBox.parse(arguments.bbox or default_bbox))


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path, help="folder holding the YYYY-MM-DD.parquet files")
    parser.add_argument("--from", dest="first", type=date.fromisoformat, metavar="YYYY-MM-DD")
    parser.add_argument("--to", dest="last", type=date.fromisoformat, metavar="YYYY-MM-DD")
    where = parser.add_mutually_exclusive_group()
    where.add_argument(
        "--area",
        choices=AREA_NAMES,
        help="a named area that follows a border, shipped with the import",
    )
    where.add_argument(
        "--bbox",
        metavar="LAT_MIN,LAT_MAX,LON_MIN,LON_MAX",
        help="a rectangle to keep; default: the COLLECTION_BBOX_FRANCE setting",
    )
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--workers",
        type=workers_count,
        default=DEFAULT_WORKERS,
        help=f"insert workers, each with its own connection, from 1 to {MAX_WORKERS} "
        f"(default {DEFAULT_WORKERS}: with the client, the import stays within "
        f"{MAX_WORKERS} cores)",
    )
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
    from services.historical.store import HistoricalUnitOfWork

    try:
        area = choose_area(arguments, opensky_settings.COLLECTION_BBOX_FRANCE)
        archive = Prc2024Archive(arguments.source)
    except (ValueError, FileNotFoundError) as error:
        raise SystemExit(f"Invalid arguments: {error}") from error
    progress = ConsoleProgress()
    progress.line(f"Area: {area.description}.")
    with Prc2024Reader(area) as reader:
        if arguments.dry_run:
            return DryRunCommand(archive, reader, progress.line, progress).run(
                arguments.first, arguments.last
            )

        # One connection for each worker, and one more for the steps around the batches.
        engine = create_async_engine(
            database_settings.DATABASE_ASYNC_URL,
            pool_pre_ping=True,
            pool_size=arguments.workers + 1,
            max_overflow=0,
        )
        try:
            command = ImportCommand(
                archive,
                reader,
                HistoricalUnitOfWork(async_sessionmaker(engine, expire_on_commit=False)),
                arguments.batch_size,
                arguments.delete_source,
                say=progress.line,
                progress=progress,
                target=(
                    f"{database_settings.DB_USER}@{database_settings.DB_HOST}:"
                    f"{database_settings.DB_PORT}/{database_settings.DB_NAME}"
                ),
                workers=arguments.workers,
            )
            return await command.run(arguments.first, arguments.last)
        finally:
            await engine.dispose()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(asyncio.run(main(parse_arguments())))
