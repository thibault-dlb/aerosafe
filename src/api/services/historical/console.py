"""What the import prints while it runs: a live progress line and the permanent lines above it."""

import shutil
import sys
import time
from collections.abc import Callable
from typing import TextIO

from services.historical.importer import Phase, Progress

# A terminal redraws a line in place; a log file would fill up with every redraw.
INTERACTIVE_INTERVAL = 0.5
LOG_INTERVAL = 10.0


def format_duration(seconds: float) -> str:
    minutes, seconds_left = divmod(round(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours} h {minutes:02d} min"
    if minutes:
        return f"{minutes} min {seconds_left:02d} s"
    return f"{seconds_left} s"


def terminal_columns() -> int:
    return shutil.get_terminal_size((100, 24)).columns


class ConsoleProgress:
    """Shows where the import stands: file, phase, points done, speed and time left.

    On a terminal the progress is one line redrawn in place, and `line` prints a permanent line
    above it. When the output is redirected to a file, nothing is redrawn: a new line is written
    at each change of phase and every few seconds, so a log stays readable.
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
        self._live_width = 0

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
        """Redraw the progress line, at most once per interval except when the phase changes."""
        now = self._clock()
        if progress.phase is Phase.INSERTING and self._insert_started is None:
            self._insert_started = now
        changed = progress.phase is not self._last_phase
        complete = progress.total > 0 and progress.done >= progress.total
        due = self._last_draw is None or now - self._last_draw >= self._interval
        self._last_phase = progress.phase
        if changed or complete or due:
            self._last_draw = now
            self._draw(self._describe(progress, now))

    def line(self, text: str) -> None:
        """Print a permanent line, above the progress line."""
        self.clear()
        self._stream.write(text + "\n")
        self._stream.flush()

    def clear(self) -> None:
        """Erase the progress line, so that nothing stays on screen when the import ends."""
        if self._interactive and self._live_width:
            self._stream.write("\r" + " " * self._live_width + "\r")
            self._stream.flush()
        self._live_width = 0

    def _describe(self, progress: Progress, now: float) -> str:
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
        elapsed = now - (self._insert_started if self._insert_started is not None else now)
        if progress.done <= 0 or elapsed <= 0:
            return text + "  starting..."
        rate = progress.done / elapsed
        file_left = (progress.total - progress.done) / rate
        text += f"  {rate:,.0f} pts/s  file: {format_duration(file_left)} left"
        if self._files > 1:
            fraction = (self._index - 1 + progress.done / progress.total) / self._files
            spent = now - self._started
            text += f"  total: {format_duration(spent / fraction - spent)} left"
        return text

    def _draw(self, text: str) -> None:
        text = text[: max(self._columns() - 1, 20)]
        if self._interactive:
            padding = " " * max(self._live_width - len(text), 0)
            self._stream.write("\r" + text + padding)
            self._live_width = max(len(text), self._live_width)
        else:
            self._stream.write(text + "\n")
        self._stream.flush()
