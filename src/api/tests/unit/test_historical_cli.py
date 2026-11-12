import io
from datetime import date
from pathlib import Path

import pytest

from services.collection.profiles import BoundingBox
from services.historical.cli import (
    EXIT_FOREIGN_DATABASE,
    EXIT_NO_FILE,
    EXIT_OK,
    DryRunCommand,
    ImportCommand,
    choose_area,
    format_duration,
    parse_arguments,
)
from services.historical.console import ConsoleProgress
from services.historical.importer import HistoricalImportError
from services.historical.prc2024 import Prc2024Archive, Prc2024Reader
from tests.historical_support import (
    FLIGHT,
    OTHER_FLIGHT,
    FakeSink,
    FakeUnitOfWork,
    Point,
    write_day,
)

FRANCE = BoundingBox(41.3, 51.1, -5.2, 9.6)


class Folder:
    """A folder of two daily files and the helpers to drive the commands over them."""

    def __init__(self, path: Path) -> None:
        # A flight is in one daily file only, so each day has its own aircraft.
        for day, flight_id in (("2022-07-01", FLIGHT), ("2022-07-02", OTHER_FLIGHT)):
            write_day(
                path / f"{day}.parquet",
                [
                    Point(flight_id=flight_id, at=f"{day} 10:00:00+00"),
                    Point(flight_id=flight_id, at=f"{day} 10:00:01+00"),
                ],
            )
        (path / "flight_list.csv").write_text("flight_id\n")
        self.path = path
        self.messages: list[str] = []
        self.transactions: list[str] = []
        self.sink = FakeSink()
        self.unit = FakeUnitOfWork(self.sink, self.transactions)

    def importing(self, delete_source: bool = False) -> ImportCommand:
        return ImportCommand(
            Prc2024Archive(self.path),
            Prc2024Reader(FRANCE),
            self.unit,
            batch_size=10,
            delete_source=delete_source,
            say=self.messages.append,
        )

    def dry_run(self) -> DryRunCommand:
        return DryRunCommand(Prc2024Archive(self.path), Prc2024Reader(FRANCE), self.messages.append)

    def lines(self) -> list[str]:
        """The per-file lines, without the announcements around them."""
        return [message for message in self.messages if message.startswith("[")]

    def files(self) -> list[str]:
        return sorted(path.name for path in self.path.iterdir())


@pytest.fixture
def folder(tmp_path: Path) -> Folder:
    return Folder(tmp_path)


class TestFormatDuration:
    @pytest.mark.parametrize(
        ("seconds", "text"),
        [
            (0, "0 s"),
            (59.4, "59 s"),
            (60, "1 min 00 s"),
            (125, "2 min 05 s"),
            (3_900, "1 h 05 min"),
        ],
    )
    def test_a_duration_is_written_in_the_largest_units(self, seconds: float, text: str) -> None:
        assert format_duration(seconds) == text


class TestDryRun:
    def test_it_reports_each_file_and_the_estimated_size(self, folder: Folder) -> None:
        code = folder.dry_run().run(None, None)

        assert code == EXIT_OK
        assert "[1/2] 2022-07-01.parquet: 2 points in 1 flights" in folder.lines()[0]
        assert "Dry run: 4 points in 2 files" in folder.messages[-1]
        assert "Nothing was written" in folder.messages[-1]

    def test_it_writes_nothing_and_deletes_nothing(self, folder: Folder) -> None:
        before = folder.files()

        folder.dry_run().run(None, None)

        assert folder.files() == before
        assert folder.sink.calls == []

    def test_a_period_without_a_file_is_reported(self, folder: Folder) -> None:
        code = folder.dry_run().run(date(2030, 1, 1), None)

        assert code == EXIT_NO_FILE
        assert folder.messages == ["No daily file to read."]


class TestImport:
    async def test_every_step_is_committed_on_its_own(self, folder: Folder) -> None:
        code = await folder.importing().run(None, None)

        assert code == EXIT_OK
        assert len(folder.sink.stored) == 4
        # The check of the database, then for each file: aircraft and flights, one batch, count.
        assert folder.transactions == ["begin", "commit"] * 7

    async def test_the_progress_and_the_end_are_reported(self, folder: Folder) -> None:
        await folder.importing().run(None, None)

        assert (
            "[1/2] 2022-07-01.parquet: 2 points, 1 aircraft, 1 flights, 2 stored"
            in (folder.lines()[0])
        )
        assert "Remaining: about" in folder.lines()[0]
        assert folder.messages[-1].startswith("Done: 4 points from 2 files")
        assert 'ANALYZE "OBSERVATION"' in folder.messages[-1]

    async def test_the_plan_and_the_target_are_announced_before_the_first_file(
        self, folder: Folder
    ) -> None:
        await folder.importing().run(None, None)

        assert folder.messages[:2] == [
            "Checking that the database only holds the dataset...",
            "Importing 2 file(s), 2022-07-01.parquet to 2022-07-02.parquet, into the database, "
            "with 6 insert worker(s).",
        ]

    async def test_the_files_stay_where_they_are_by_default(self, folder: Folder) -> None:
        before = folder.files()

        await folder.importing().run(None, None)

        assert folder.files() == before

    async def test_a_second_run_loads_nothing_again(self, folder: Folder) -> None:
        await folder.importing().run(None, None)
        folder.messages.clear()

        await folder.importing().run(None, None)

        assert "already loaded" in folder.lines()[0]
        assert len(folder.sink.stored) == 4

    async def test_only_the_requested_period_is_imported(self, folder: Folder) -> None:
        await folder.importing().run(date(2022, 7, 2), date(2022, 7, 2))

        assert len(folder.sink.stored) == 2
        assert "2022-07-02.parquet" in folder.lines()[0]

    async def test_a_period_without_a_file_imports_nothing(self, folder: Folder) -> None:
        code = await folder.importing().run(date(2030, 1, 1), None)

        assert code == EXIT_NO_FILE
        assert folder.sink.calls == []

    async def test_a_database_with_other_data_is_refused_before_anything_is_written(
        self, folder: Folder
    ) -> None:
        folder.sink.foreign_data = True

        code = await folder.importing(delete_source=True).run(None, None)

        assert code == EXIT_FOREIGN_DATABASE
        assert folder.sink.calls == ["has_observations_outside"]
        assert "2022-07-01.parquet" in folder.files()
        assert any("import into a database of its own" in m for m in folder.messages)


class TestDeleteSource:
    async def test_each_file_is_deleted_once_it_is_in_the_database(self, folder: Folder) -> None:
        code = await folder.importing(delete_source=True).run(None, None)

        assert code == EXIT_OK
        assert folder.files() == ["flight_list.csv"]  # only the daily files are deleted
        assert len(folder.sink.stored) == 4
        assert any(message.startswith("Deleted 2022-07-01.parquet") for message in folder.messages)

    async def test_a_file_that_fails_the_check_is_not_deleted(self, folder: Folder) -> None:
        # The first file is fine; the second one loses its rows, so its check fails.
        command = folder.importing(delete_source=True)
        original = folder.sink.insert_observations
        calls = 0

        async def lose_the_second_file(batch):
            nonlocal calls
            calls += 1
            return await original(batch) if calls == 1 else 0

        folder.sink.insert_observations = lose_the_second_file

        with pytest.raises(HistoricalImportError):
            await command.run(None, None)

        assert folder.files() == ["2022-07-02.parquet", "flight_list.csv"]

    async def test_the_deletion_is_announced(self, folder: Folder) -> None:
        await folder.importing(delete_source=True).run(None, None)

        assert any(m.startswith("--delete-source") for m in folder.messages)


class TestArguments:
    def test_the_defaults(self) -> None:
        arguments = parse_arguments(["data/prc2024"])

        assert arguments.source == Path("data/prc2024")
        assert (arguments.first, arguments.last, arguments.bbox) == (None, None, None)
        assert (arguments.dry_run, arguments.delete_source) == (False, False)
        assert arguments.batch_size == 50_000
        assert arguments.workers == 6

    def test_the_options(self) -> None:
        arguments = parse_arguments(
            [
                "data/prc2024",
                "--from",
                "2022-07-01",
                "--to",
                "2022-07-31",
                "--bbox",
                "48,49.3,1.4,3.6",
                "--batch-size",
                "1000",
                "--dry-run",
                "--delete-source",
            ]
        )

        assert arguments.first == date(2022, 7, 1)
        assert arguments.last == date(2022, 7, 31)
        assert arguments.bbox == "48,49.3,1.4,3.6"
        assert arguments.batch_size == 1000
        assert arguments.dry_run and arguments.delete_source

    @pytest.mark.parametrize("workers", [1, 6, 7, 16, 64])
    def test_the_workers_have_no_upper_limit(self, workers: int) -> None:
        assert parse_arguments(["data/prc2024", "--workers", str(workers)]).workers == workers

    @pytest.mark.parametrize("workers", ["0", "-2", "many"])
    def test_no_worker_or_not_a_number_is_refused(
        self, workers: str, capsys: pytest.CaptureFixture[str]
    ) -> None:
        with pytest.raises(SystemExit):
            parse_arguments(["data/prc2024", "--workers", workers])

        assert "--workers" in capsys.readouterr().err

    def test_an_invalid_date_is_refused(self) -> None:
        with pytest.raises(SystemExit):
            parse_arguments(["data/prc2024", "--from", "01/07/2022"])


class TestWorkersOfTheCommand:
    async def test_the_command_hands_its_workers_to_the_importer(self, folder: Folder) -> None:
        command = ImportCommand(
            Prc2024Archive(folder.path),
            Prc2024Reader(FRANCE),
            folder.unit,
            batch_size=1,
            say=folder.messages.append,
            workers=2,
        )

        await command.run(None, None)

        assert any("with 2 insert worker(s)" in message for message in folder.messages)
        assert folder.unit.max_active <= 2

    def test_no_worker_is_refused_before_anything_starts(self, folder: Folder) -> None:
        with pytest.raises(ValueError, match="at least one worker"):
            ImportCommand(
                Prc2024Archive(folder.path), Prc2024Reader(FRANCE), folder.unit, workers=0
            )


class TestLiveProgress:
    """The commands with the real console display, writing to a string."""

    @staticmethod
    def console() -> tuple[ConsoleProgress, io.StringIO]:
        stream = io.StringIO()
        return ConsoleProgress(stream, interactive=False, interval=0), stream

    async def test_every_file_shows_its_phases_and_its_points(self, folder: Folder) -> None:
        progress, stream = self.console()
        command = ImportCommand(
            Prc2024Archive(folder.path),
            Prc2024Reader(FRANCE),
            folder.unit,
            batch_size=1,
            say=progress.line,
            progress=progress,
            target="aerosafe_user@127.0.0.1:5432/aerosafe_db",
        )

        await command.run(None, None)

        output = stream.getvalue()
        assert "Importing 2 file(s), 2022-07-01.parquet to 2022-07-02.parquet" in output
        assert "into aerosafe_user@127.0.0.1:5432/aerosafe_db, with 6 insert worker(s)." in output
        assert "[1/2] 2022-07-01.parquet  reading and cleaning the file..." in output
        assert "[1/2] 2022-07-01.parquet  inserting 1 / 2 points (50.0 %)" in output
        assert "[2/2] 2022-07-02.parquet  inserting 2 / 2 points (100.0 %)" in output
        assert "[2/2] 2022-07-02.parquet  checking the database..." in output
        assert "Done: 4 points from 2 files" in output

    def test_a_dry_run_shows_the_file_being_read_and_the_time_left(self, folder: Folder) -> None:
        progress, stream = self.console()
        command = DryRunCommand(
            Prc2024Archive(folder.path), Prc2024Reader(FRANCE), progress.line, progress
        )

        command.run(None, None)

        output = stream.getvalue()
        assert "Reading 2 file(s), 2022-07-01.parquet to 2022-07-02.parquet." in output
        assert "[2/2] 2022-07-02.parquet  reading and cleaning the file..." in output
        assert "Remaining: about" in output

    async def test_the_progress_line_is_erased_even_when_a_file_fails(self, folder: Folder) -> None:
        stream = io.StringIO()
        progress = ConsoleProgress(stream, interactive=True, interval=0)
        folder.sink.insert_observations = lambda batch: _fail()  # type: ignore[assignment]
        command = ImportCommand(
            Prc2024Archive(folder.path),
            Prc2024Reader(FRANCE),
            folder.unit,
            say=progress.line,
            progress=progress,
        )

        with pytest.raises(HistoricalImportError):
            await command.run(None, None)

        assert stream.getvalue().endswith("\r")  # the last thing written clears the line


async def _fail():
    raise HistoricalImportError("boom")


class TestAreaArgument:
    DEFAULT = "41.3,51.1,-5.2,9.6"

    def test_a_named_area_is_the_mask_of_that_name(self) -> None:
        arguments = parse_arguments(["data/prc2024", "--area", "france-100km"])

        area = choose_area(arguments, self.DEFAULT)

        assert (area.name, area.is_mask) == ("france-100km", True)

    def test_without_an_option_the_rectangle_of_the_france_profile_is_kept(self) -> None:
        area = choose_area(parse_arguments(["data/prc2024"]), self.DEFAULT)

        assert area.is_mask is False
        assert (area.bounds.lat_min, area.bounds.lon_max) == (41.3, 9.6)

    def test_a_rectangle_can_be_given(self) -> None:
        arguments = parse_arguments(["data/prc2024", "--bbox", "48.0,49.3,1.4,3.6"])

        assert choose_area(arguments, self.DEFAULT).bounds.lat_max == 49.3

    def test_a_bad_rectangle_is_a_value_error_for_main_to_report(self) -> None:
        arguments = parse_arguments(["data/prc2024", "--bbox", "1,2,3"])

        with pytest.raises(ValueError, match="4 numbers"):
            choose_area(arguments, self.DEFAULT)

    def test_an_unknown_area_is_refused_by_the_parser(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        with pytest.raises(SystemExit):
            parse_arguments(["data/prc2024", "--area", "spain"])

        assert "invalid choice" in capsys.readouterr().err

    def test_an_area_and_a_rectangle_cannot_be_given_together(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        with pytest.raises(SystemExit):
            parse_arguments(["data/prc2024", "--area", "france-100km", "--bbox", "1,2,3,4"])

        assert "not allowed with argument" in capsys.readouterr().err
