"""What the import prints while it runs: live progress bars and the permanent lines above them."""

import os
import shutil
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
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


@dataclass
class _FileState:
    """What the display knows about a file being imported."""

    index: int
    progress: Progress | None = None
    phase: Phase | None = None
    insert_started: float | None = None
    last_draw: float | None = None


class ConsoleProgress:
    """Shows where the import stands: the whole run, then each file being loaded.

    On a terminal the first line is a bar for all the files and below it, one line for each file
    being loaded (several when files are imported in parallel), all redrawn in place. `line`
    prints a permanent line above them. When the output is redirected to a file, nothing is
    redrawn: a new line is written at each change of phase and every few seconds, so a log stays
    readable.
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
        self._completed = 0
        self._started = clock()
        self._states: dict[Path, _FileState] = {}
        self._last_draw: float | None = None
        self._live_lines = 0

    def begin(self, files: int) -> None:
        """Start the overall clock for `files` files."""
        self._files = max(files, 1)
        self._completed = 0
        self._states.clear()
        self._started = self._clock()

    def begin_file(self, index: int, path: Path) -> None:
        """The file number `index` (from 1) starts: its progress events carry `path`."""
        self._states[path] = _FileState(index)

    def end_file(self, path: Path) -> None:
        """The file is done: it counts in the overall bar and leaves the screen."""
        if self._states.pop(path, None) is not None:
            self._completed += 1

    def update(self, progress: Progress) -> None:
        """Redraw the progress, at most once per interval except when a phase changes."""
        now = self._clock()
        state = self._states.setdefault(progress.path, _FileState(1))
        state.progress = progress
        if progress.phase is Phase.INSERTING and state.insert_started is None:
            state.insert_started = now
        changed = progress.phase is not state.phase
        state.phase = progress.phase
        complete = progress.total > 0 and progress.done >= progress.total
        # A terminal redraws everything at once; a log gets a line for each file in its turn.
        last = self._last_draw if self._interactive else state.last_draw
        due = last is None or now - last >= self._interval
        if changed or complete or due:
            self._last_draw = state.last_draw = now
            if self._interactive:
                self._draw_live(self._live_lines_of(now))
            else:
                self._write_log(self._describe(state, progress, now))

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

    @staticmethod
    def _file_fraction(progress: Progress | None) -> float:
        """How much of a file is stored, from 0 to 1."""
        if progress and progress.phase in (Phase.INSERTING, Phase.VERIFYING) and progress.total > 0:
            return min(progress.done / progress.total, 1.0)
        return 0.0

    def _all_fraction(self) -> float:
        """How much of all the files is stored, each file weighing the same."""
        loading = sum(self._file_fraction(state.progress) for state in self._states.values())
        return (self._completed + loading) / self._files

    @staticmethod
    def _insert_rate(state: _FileState, progress: Progress, now: float) -> float | None:
        """Points stored a second since the insertion began, or None before it has a speed."""
        elapsed = now - (state.insert_started if state.insert_started is not None else now)
        if progress.done <= 0 or elapsed <= 0:
            return None
        return progress.done / elapsed

    def _live_lines_of(self, now: float) -> list[str]:
        loading = sorted(
            (state for state in self._states.values() if state.progress is not None),
            key=lambda state: state.index,
        )
        return [self._describe_all(now)] + [
            self._describe_file(state, state.progress, now)
            for state in loading
            if state.progress is not None
        ]

    def _describe_all(self, now: float) -> str:
        fraction = self._all_fraction()
        spent = now - self._started
        text = (
            f"{'All files':<{LABEL_WIDTH}}{format_bar(fraction)} {100 * fraction:5.1f} %"
            f"  {self._completed}/{self._files} files done  elapsed {format_duration(spent)}"
        )
        if fraction > 0 and spent > 0:
            text += f"  left {format_duration(spent / fraction - spent)}"
        return text

    def _describe_file(self, state: _FileState, progress: Progress, now: float) -> str:
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
        rate = self._insert_rate(state, progress, now)
        if rate is None:
            return text + "  starting..."
        file_left = (progress.total - progress.done) / rate
        return text + f"  {rate:,.0f} pts/s  left {format_duration(file_left)}"

    def _describe(self, state: _FileState, progress: Progress, now: float) -> str:
        """The single line of a log."""
        prefix = f"[{state.index}/{self._files}] {progress.path.name}  "
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
        rate = self._insert_rate(state, progress, now)
        if rate is None:
            return text + "  starting..."
        file_left = (progress.total - progress.done) / rate
        text += f"  {rate:,.0f} pts/s  file: {format_duration(file_left)} left"
        if self._files > 1:
            fraction = self._all_fraction()
            spent = now - self._started
            text += f"  total: {format_duration(spent / fraction - spent)} left"
        return text

    def _draw_live(self, lines: list[str]) -> None:
        """Draw the bars over the previous ones, never wider than the terminal.

        Fewer lines than the previous drawing leave old ones under the new: they are erased.
        """
        width = max(self._columns() - 1, 20)
        text = (ERASE_LINE_END + "\n").join(line[:width] for line in lines)
        up = CURSOR_UP * (self._live_lines - 1) if self._live_lines else ""
        self._stream.write(up + "\r" + text + ERASE_LINE_END + ERASE_SCREEN_END)
        self._live_lines = len(lines)
        self._stream.flush()

    def _write_log(self, text: str) -> None:
        self._stream.write(text + "\n")
        self._stream.flush()
