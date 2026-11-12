import io
from pathlib import Path

import pytest

from services.historical.console import (
    LOG_INTERVAL,
    ConsoleProgress,
    format_duration,
)
from services.historical.importer import Phase, Progress

FILE = Path("2022-07-01.parquet")


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class Console:
    """A progress display writing to a string, with a clock the test moves by hand."""

    def __init__(self, interactive: bool = True, interval: float = 0.5, columns: int = 200) -> None:
        self.clock = Clock()
        self.stream = io.StringIO()
        self.progress = ConsoleProgress(
            self.stream, self.clock, interactive, interval, lambda: columns
        )

    def insert(self, done: int, total: int = 1000, at: float | None = None) -> None:
        if at is not None:
            self.clock.now = at
        self.progress.update(Progress(FILE, Phase.INSERTING, done, total))

    @property
    def output(self) -> str:
        return self.stream.getvalue()


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


class TestPhases:
    def test_the_file_and_the_phase_are_named(self) -> None:
        console = Console()
        console.progress.begin(3)
        console.progress.begin_file(2)

        console.progress.update(Progress(FILE, Phase.READING))

        assert console.output == "\r[2/3] 2022-07-01.parquet  reading and cleaning the file..."

    def test_the_number_of_points_kept_is_shown_while_the_flights_are_created(self) -> None:
        console = Console()

        console.progress.update(Progress(FILE, Phase.PREPARING, total=3_740_123))

        assert "3,740,123 points kept, creating the aircraft and the flights..." in console.output

    def test_the_check_of_the_database_is_named(self) -> None:
        console = Console()

        console.progress.update(Progress(FILE, Phase.VERIFYING, 10, 10))

        assert "checking the database..." in console.output


class TestInserting:
    def test_the_first_event_has_no_speed_yet(self) -> None:
        console = Console()

        console.insert(0, at=0)

        assert "inserting 0 / 1,000 points (0.0 %)  starting..." in console.output

    def test_the_speed_and_the_time_left_come_from_the_points_done(self) -> None:
        console = Console()
        console.insert(0, at=0)

        console.insert(250, at=10)  # 25 points a second, 750 points left

        assert "inserting 250 / 1,000 points (25.0 %)  25 pts/s  file: 30 s left" in console.output
        assert "total:" not in console.output  # one file: the total is the file

    def test_the_total_time_left_counts_the_files_still_to_do(self) -> None:
        console = Console()
        console.progress.begin(4)
        console.progress.begin_file(2)
        console.insert(0, at=0)

        # Half of the second file after 100 s: 1.5 files of 4 are done, so 166.7 s are left.
        console.insert(500, at=100)

        assert "5 pts/s  file: 1 min 40 s left  total: 2 min 47 s left" in console.output

    def test_a_file_without_a_point_says_so(self) -> None:
        console = Console()

        console.insert(0, total=0)

        assert "nothing to insert" in console.output


class TestRedraw:
    def test_a_terminal_redraws_the_same_line_in_place(self) -> None:
        console = Console(interactive=True)

        console.insert(0, at=0)
        console.insert(500, at=1)

        assert console.output.count("\r") == 2
        assert "\n" not in console.output

    def test_an_update_inside_the_interval_is_skipped(self) -> None:
        console = Console(interval=0.5)
        console.insert(0, at=0)

        console.insert(100, at=0.1)
        console.insert(200, at=0.4)
        console.insert(300, at=0.6)

        assert console.output.count("\r") == 2
        assert "300 / 1,000" in console.output
        assert "100 / 1,000" not in console.output

    def test_the_last_update_of_a_file_is_always_drawn(self) -> None:
        console = Console(interval=60)
        console.insert(0, at=0)

        console.insert(1000, at=0.1)

        assert "1,000 / 1,000 points (100.0 %)" in console.output

    def test_a_change_of_phase_is_always_drawn(self) -> None:
        console = Console(interval=60)
        console.progress.update(Progress(FILE, Phase.READING))

        console.progress.update(Progress(FILE, Phase.PREPARING, total=5))

        assert console.output.count("\r") == 2

    def test_a_shorter_line_erases_the_end_of_a_longer_one(self) -> None:
        console = Console(interval=0)
        console.progress.update(Progress(FILE, Phase.PREPARING, total=3_740_123))
        longest = len(console.output) - 1  # without the carriage return

        console.progress.update(Progress(FILE, Phase.VERIFYING, 5, 5))

        second = console.output.split("\r")[-1]
        assert len(second) == longest

    def test_a_line_longer_than_the_terminal_is_cut(self) -> None:
        console = Console(columns=40)

        console.insert(0, at=0)

        assert len(console.output.removeprefix("\r")) == 39


class TestLog:
    def test_a_redirected_output_gets_lines_never_carriage_returns(self) -> None:
        console = Console(interactive=False, interval=LOG_INTERVAL)

        console.progress.update(Progress(FILE, Phase.READING))
        console.progress.update(Progress(FILE, Phase.PREPARING, total=5))

        assert "\r" not in console.output
        assert console.output.count("\n") == 2

    def test_a_log_is_written_every_few_seconds_not_at_every_batch(self) -> None:
        console = Console(interactive=False, interval=10)
        console.insert(0, at=0)

        for second in range(1, 25):
            console.insert(second * 10, at=second)

        assert console.output.count("\n") == 3  # at 0 s, 10 s and 20 s

    def test_the_default_depends_on_whether_the_output_is_a_terminal(self) -> None:
        assert ConsoleProgress(io.StringIO())._interval == LOG_INTERVAL


class TestPermanentLines:
    def test_a_permanent_line_replaces_the_progress_line(self) -> None:
        console = Console()
        console.insert(0, at=0)
        width = len(console.output) - 1

        console.progress.line("[1/1] 2022-07-01.parquet: done")

        assert console.output.endswith("\r" + " " * width + "\r[1/1] 2022-07-01.parquet: done\n")

    def test_without_a_progress_line_nothing_is_erased(self) -> None:
        console = Console()

        console.progress.line("hello")

        assert console.output == "hello\n"

    def test_a_log_is_never_erased(self) -> None:
        console = Console(interactive=False)
        console.insert(0, at=0)

        console.progress.line("hello")

        assert "\r" not in console.output
        assert console.output.endswith("hello\n")

    def test_clearing_twice_is_harmless(self) -> None:
        console = Console()
        console.insert(0, at=0)

        console.progress.clear()
        before = console.output
        console.progress.clear()

        assert console.output == before
