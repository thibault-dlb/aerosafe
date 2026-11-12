"""What the import prints while it runs: live progress bars and the permanent lines above them."""

import os
import shutil
import sys
import time
from collections.abc import Callable
from typing import TextIO

from services.historical.importer import Phase, Progress

# A terminal redraws its bars in place; a log file would fill up with every redraw.
INTERACTIVE_INTERVAL = 0.5
LOG_INTERVAL = 10.0

BAR_WIDTH = 30
LABEL_WIDTH = 20

# ANSI sequences: cursor up one line, erase to the end of the line, erase to the end of the screen.
CURSOR_UP = "\x1b[1A"
ERASE_LINE_END = "\x1b[K"
ERASE_SCREEN_END = "\x1b[J"


def format_duration(seconds: float) -> str:
    minutes, seconds_left = divmod(round(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours} h {minutes:02d} min"
    if minutes:
        return f"{minutes} min {seconds_left:02d} s"
    return f"{seconds_left} s"


def format_bar(fraction: float, width: int = BAR_WIDTH) -> str:
    """A text bar such as `[#####-----]`, filled in proportion to `fraction` (0 to 1)."""
    filled = round(width * min(max(fraction, 0.0), 1.0))
    return "[" + "#" * filled + "-" * (width - filled) + "]"


def terminal_columns() -> int:
    return shutil.get_terminal_size((100, 24)).columns


def enable_ansi() -> None:
    """Make the Windows console understand ANSI sequences (a no-op elsewhere).

    Running any command, even an empty one, switches on the virtual terminal processing of the
    console that the process shares.
    """
    if sys.platform == "win32":
        os.system("")  # noqa: S605, S607


class ConsoleProgress:
    """Shows where the import stands: the whole run, then the file being loaded.

    On a terminal two bars are redrawn in place: the first one for all the files, the second one,
    just below, for the current file (phase, points done, speed and time left). `line` prints a
    permanent line above them. When the output is redirected to a file, nothing is redrawn: a new
    line is written at each change of phase and every few seconds, so a log stays readable.
    """

    def __init__(
        self,
        stream: TextIO | None = None,
        clock: Callable[[], float] = time.monotonic,
        interactive: bool | None = None,
        interval: float | None = None,
        columns: Callable[[], int] = terminal_columns,
    ) -> None:
        self._stream = stream or sys.stdout
        self._clock = clock
        self._interactive = self._stream.isatty() if interactive is None else interactive
        if interactive is None and self._interactive:
            enable_ansi()
        self._interval = (
            interval
            if interval is not None
            else (INTERACTIVE_INTERVAL if self._interactive else LOG_INTERVAL)
        )
        self._columns = columns
        self._files = 1
        self._started = clock()
        self._index = 1
        self._insert_started: float | None = None
        self._last_phase: Phase | None = None
        self._last_draw: float | None = None
        self._live_lines = 0

    def begin(self, files: int) -> None:
        """Start the overall clock for `files` files."""
        self._files = max(files, 1)
        self._started = self._clock()

    def begin_file(self, index: int) -> None:
        """The next progress events are for the file number `index` (from 1)."""
        self._index = index
        self._insert_started = None
        self._last_phase = None
        self._last_draw = None

    def update(self, progress: Progress) -> None:
        """Redraw the progress, at most once per interval except when the phase changes."""
        now = self._clock()
        if progress.phase is Phase.INSERTING and self._insert_started is None:
            self._insert_started = now
        changed = progress.phase is not self._last_phase
        complete = progress.total > 0 and progress.done >= progress.total
        due = self._last_draw is None or now - self._last_draw >= self._interval
        self._last_phase = progress.phase
        if changed or complete or due:
            self._last_draw = now
            if self._interactive:
                self._draw_live(
                    [self._describe_all(progress, now), self._describe_file(progress, now)]
                )
            else:
                self._write_log(self._describe(progress, now))

    def line(self, text: str) -> None:
        """Print a permanent line, above the progress bars."""
        self.clear()
        self._stream.write(text + "\n")
        self._stream.flush()

    def clear(self) -> None:
        """Erase the bars, so that nothing stays on screen when the import ends."""
        if self._interactive and self._live_lines:
            self._stream.write(CURSOR_UP * (self._live_lines - 1) + "\r" + ERASE_SCREEN_END)
            self._stream.flush()
        self._live_lines = 0

    def _file_fraction(self, progress: Progress) -> float:
        """How much of the current file is stored, from 0 to 1."""
        if progress.phase in (Phase.INSERTING, Phase.VERIFYING) and progress.total > 0:
            return min(progress.done / progress.total, 1.0)
        return 0.0

    def _all_fraction(self, progress: Progress) -> float:
        """How much of all the files is stored, each file weighing the same."""
        return (self._index - 1 + self._file_fraction(progress)) / self._files

    def _insert_rate(self, progress: Progress, now: float) -> float | None:
        """Points stored a second since the insertion began, or None before it has a speed."""
        elapsed = now - (self._insert_started if self._insert_started is not None else now)
        if progress.done <= 0 or elapsed <= 0:
            return None
        return progress.done / elapsed

    def _describe_all(self, progress: Progress, now: float) -> str:
        fraction = self._all_fraction(progress)
        spent = now - self._started
        text = (
            f"{'All files':<{LABEL_WIDTH}}{format_bar(fraction)} {100 * fraction:5.1f} %"
            f"  file {self._index}/{self._files}  elapsed {format_duration(spent)}"
        )
        if fraction > 0 and spent > 0:
            text += f"  left {format_duration(spent / fraction - spent)}"
        return text

    def _describe_file(self, progress: Progress, now: float) -> str:
        fraction = self._file_fraction(progress)
        text = f"{progress.path.name:<{LABEL_WIDTH}}{format_bar(fraction)} {100 * fraction:5.1f} %"
        if progress.phase is not Phase.INSERTING:
            detail = progress.phase.value
            if progress.phase is Phase.PREPARING:
                detail = f"{progress.total:,} points kept, {detail}"
            return f"{text}  {detail}..."
        if progress.total <= 0:
            return f"{text}  nothing to insert"
        text += f"  {progress.done:,} / {progress.total:,} points"
        rate = self._insert_rate(progress, now)
        if rate is None:
            return text + "  starting..."
        file_left = (progress.total - progress.done) / rate
        return text + f"  {rate:,.0f} pts/s  left {format_duration(file_left)}"

    def _describe(self, progress: Progress, now: float) -> str:
        """The single line of a log."""
        prefix = f"[{self._index}/{self._files}] {progress.path.name}  "
        if progress.phase is not Phase.INSERTING:
            detail = progress.phase.value
            if progress.phase is Phase.PREPARING:
                detail = f"{progress.total:,} points kept, {detail}"
            return f"{prefix}{detail}..."
        if progress.total <= 0:
            return f"{prefix}nothing to insert"

        text = (
            f"{prefix}inserting {progress.done:,} / {progress.total:,} points "
            f"({100 * progress.done / progress.total:.1f} %)"
        )
        rate = self._insert_rate(progress, now)
        if rate is None:
            return text + "  starting..."
        file_left = (progress.total - progress.done) / rate
        text += f"  {rate:,.0f} pts/s  file: {format_duration(file_left)} left"
        if self._files > 1:
            fraction = self._all_fraction(progress)
            spent = now - self._started
            text += f"  total: {format_duration(spent / fraction - spent)} left"
        return text

    def _draw_live(self, lines: list[str]) -> None:
        """Draw the bars over the previous ones, one line each, never wider than the terminal."""
        width = max(self._columns() - 1, 20)
        text = (ERASE_LINE_END + "\n").join(line[:width] for line in lines) + ERASE_LINE_END
        up = CURSOR_UP * (self._live_lines - 1) if self._live_lines else ""
        self._stream.write(up + "\r" + text)
        self._live_lines = len(lines)
        self._stream.flush()

    def _write_log(self, text: str) -> None:
        self._stream.write(text + "\n")
        self._stream.flush()
