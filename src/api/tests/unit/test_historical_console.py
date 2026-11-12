import io
from pathlib import Path

import pytest

from services.historical import console as console_module
from services.historical.console import (
    CURSOR_UP,
    ERASE_LINE_END,
    ERASE_SCREEN_END,
    LOG_INTERVAL,
    ConsoleProgress,
    enable_ansi,
    format_bar,
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

    @property
    def frame(self) -> list[str]:
        """The two lines of the last drawing: all the files, then the current file."""
        last = self.output.split("\r")[-1]
        return last.replace(ERASE_LINE_END, "").split("\n")


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


class TestFormatBar:
    @pytest.mark.parametrize(
        ("fraction", "bar"),
        [
            (0, "[----------]"),
            (0.5, "[#####-----]"),
            (1, "[##########]"),
            (-1, "[----------]"),
            (2, "[##########]"),
        ],
    )
    def test_the_bar_is_filled_in_proportion_and_kept_within_its_width(
        self, fraction: float, bar: str
    ) -> None:
        assert format_bar(fraction, width=10) == bar


class TestPhases:
    def test_the_file_and_the_phase_are_named(self) -> None:
        console = Console()
        console.progress.begin(3)
        console.progress.begin_file(2)

        console.progress.update(Progress(FILE, Phase.READING))

        all_files, current = console.frame
        assert all_files.startswith("All files")
        assert "33.3 %  file 2/3" in all_files  # one file of three is done
        assert current.startswith("2022-07-01.parquet")
        assert current.endswith("0.0 %  reading and cleaning the file...")

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

        assert console.frame[1].endswith("0 / 1,000 points  starting...")

    def test_the_speed_and_the_time_left_come_from_the_points_done(self) -> None:
        console = Console()
        console.insert(0, at=0)

        console.insert(250, at=10)  # 25 points a second, 750 points left

        all_files, current = console.frame
        assert "25.0 %" in current
        assert current.endswith("250 / 1,000 points  25 pts/s  left 30 s")
        assert "25.0 %  file 1/1  elapsed 10 s  left 30 s" in all_files  # one file: same as it

    def test_the_total_time_left_counts_the_files_still_to_do(self) -> None:
        console = Console()
        console.progress.begin(4)
        console.progress.begin_file(2)
        console.insert(0, at=0)

        # Half of the second file after 100 s: 1.5 files of 4 are done, so 166.7 s are left.
        console.insert(500, at=100)

        all_files, current = console.frame
        assert "37.5 %  file 2/4  elapsed 1 min 40 s  left 2 min 47 s" in all_files
        assert current.endswith("500 / 1,000 points  5 pts/s  left 1 min 40 s")

    def test_the_total_has_no_time_left_before_anything_is_stored(self) -> None:
        console = Console()
        console.insert(0, at=5)

        assert "left" not in console.frame[0]

    def test_the_bars_follow_the_fractions(self) -> None:
        console = Console()
        console.progress.begin(2)
        console.progress.begin_file(2)

        console.insert(1000, at=1)

        all_files, current = console.frame
        assert format_bar(1.0) in current
        assert format_bar(1.0) in all_files

    def test_a_file_without_a_point_says_so(self) -> None:
        console = Console()

        console.insert(0, total=0)

        assert "nothing to insert" in console.output


class TestRedraw:
    def test_a_terminal_redraws_the_two_lines_in_place(self) -> None:
        console = Console(interactive=True)

        console.insert(0, at=0)
        console.insert(500, at=1)

        assert console.output.count("\r") == 2
        assert console.output.count("\n") == 2  # one between the two bars, in each drawing
        assert console.output.split("\r")[1].endswith(CURSOR_UP)  # the second goes back up

    def test_the_first_drawing_does_not_move_the_cursor_up(self) -> None:
        console = Console()

        console.insert(0, at=0)

        assert CURSOR_UP not in console.output

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

        assert "100.0 %" in console.frame[1]
        assert "1,000 / 1,000 points" in console.frame[1]

    def test_a_change_of_phase_is_always_drawn(self) -> None:
        console = Console(interval=60)
        console.progress.update(Progress(FILE, Phase.READING))

        console.progress.update(Progress(FILE, Phase.PREPARING, total=5))

        assert console.output.count("\r") == 2

    def test_every_line_erases_what_was_left_of_the_previous_drawing(self) -> None:
        console = Console(interval=0)
        console.progress.update(Progress(FILE, Phase.PREPARING, total=3_740_123))

        console.progress.update(Progress(FILE, Phase.VERIFYING, 5, 5))

        last = console.output.split("\r")[-1]
        assert last.count(ERASE_LINE_END) == 2
        assert last.endswith(ERASE_LINE_END)

    def test_a_line_longer_than_the_terminal_is_cut(self) -> None:
        console = Console(columns=40)

        console.insert(0, at=0)

        assert [len(line) for line in console.frame] == [39, 39]


class TestLogLines:
    def test_a_log_line_is_never_cut_to_the_width_of_a_terminal(self) -> None:
        console = Console(interactive=False, columns=40)

        console.insert(0, at=0)
        console.insert(500, at=100)

        assert "file: 1 min 40 s left" in console.output


class TestLog:
    def test_a_redirected_output_gets_lines_never_carriage_returns(self) -> None:
        console = Console(interactive=False, interval=LOG_INTERVAL)

        console.progress.update(Progress(FILE, Phase.READING))
        console.progress.update(Progress(FILE, Phase.PREPARING, total=5))

        assert "\r" not in console.output
        assert "\x1b" not in console.output
        assert console.output.count("\n") == 2

    def test_a_log_is_written_every_few_seconds_not_at_every_batch(self) -> None:
        console = Console(interactive=False, interval=10)
        console.insert(0, at=0)

        for second in range(1, 25):
            console.insert(second * 10, at=second)

        assert console.output.count("\n") == 3  # at 0 s, 10 s and 20 s

    def test_the_total_time_left_is_part_of_a_log_line(self) -> None:
        console = Console(interactive=False)
        console.progress.begin(4)
        console.progress.begin_file(2)
        console.insert(0, at=0)

        console.insert(500, at=100)

        assert "5 pts/s  file: 1 min 40 s left  total: 2 min 47 s left" in console.output

    def test_the_default_depends_on_whether_the_output_is_a_terminal(self) -> None:
        assert ConsoleProgress(io.StringIO())._interval == LOG_INTERVAL


class TestPermanentLines:
    def test_a_permanent_line_replaces_the_bars(self) -> None:
        console = Console()
        console.insert(0, at=0)

        console.progress.line("[1/1] 2022-07-01.parquet: done")

        erase = CURSOR_UP + "\r" + ERASE_SCREEN_END  # back to the first bar, then wipe both
        assert console.output.endswith(erase + "[1/1] 2022-07-01.parquet: done\n")

    def test_the_bars_are_drawn_again_below_a_permanent_line(self) -> None:
        console = Console(interval=0)
        console.insert(0, at=0)
        console.progress.line("done")
        before = len(console.output)

        console.insert(500, at=1)

        assert CURSOR_UP not in console.output[before:]
        assert console.output[before:].startswith("\rAll files")

    def test_without_bars_nothing_is_erased(self) -> None:
        console = Console()

        console.progress.line("hello")

        assert console.output == "hello\n"

    def test_a_log_is_never_erased(self) -> None:
        console = Console(interactive=False)
        console.insert(0, at=0)

        console.progress.line("hello")

        assert "\r" not in console.output
        assert "\x1b" not in console.output
        assert console.output.endswith("hello\n")

    def test_clearing_twice_is_harmless(self) -> None:
        console = Console()
        console.insert(0, at=0)

        console.progress.clear()
        before = console.output
        console.progress.clear()

        assert console.output == before


class TestAnsi:
    def test_windows_gets_its_console_switched_to_ansi(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        commands: list[str] = []
        monkeypatch.setattr(console_module.sys, "platform", "win32")
        monkeypatch.setattr(console_module.os, "system", commands.append)

        enable_ansi()

        assert commands == [""]

    def test_other_systems_are_left_alone(self, monkeypatch: pytest.MonkeyPatch) -> None:
        commands: list[str] = []
        monkeypatch.setattr(console_module.sys, "platform", "linux")
        monkeypatch.setattr(console_module.os, "system", commands.append)

        enable_ansi()

        assert commands == []

    def test_a_terminal_found_by_itself_gets_ansi(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class Terminal(io.StringIO):
            def isatty(self) -> bool:
                return True

        calls: list[str] = []
        monkeypatch.setattr(console_module, "enable_ansi", lambda: calls.append("ansi"))

        ConsoleProgress(Terminal())
        ConsoleProgress(io.StringIO())  # a file: nothing to enable
        ConsoleProgress(Terminal(), interactive=True)  # chosen by the caller: left as it is

        assert calls == ["ansi"]
