# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb>=1.1"]
# ///
"""Verify the files of the PRC Data Challenge 2024 before and after a copy (docs/historical-data.md).

For each daily parquet file it reads every column of every row, and keeps the size, the number
of rows and a checksum of all the values. The other files of the folder (flight_list.csv, the
README) get their size and a SHA-256. A copy that has lost or changed a single byte shows up.

    uv run scripts/verify_prc2024.py write data/prc2024    # writes data/prc2024/MANIFEST.csv
    uv run scripts/verify_prc2024.py check data/prc2024    # compares the folder with its manifest

`write` is run on the folder that is known to be good, `check` on the copy. Both read the whole
dataset (about 306 GB): expect several minutes, with a progress line for each file. DuckDB is
limited to 6 threads, as the rest of the import.
"""

import argparse
import csv
import hashlib
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import duckdb

MANIFEST = "MANIFEST.csv"
THREADS = 6
MASK = (1 << 64) - 1


@dataclass(frozen=True)
class Entry:
    """What is known about one file."""

    name: str
    kind: str  # "parquet" or "file"
    size: int
    rows: int | None
    checksum: str


def format_duration(seconds: float) -> str:
    minutes, seconds_left = divmod(round(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours} h {minutes:02d} min"
    if minutes:
        return f"{minutes} min {seconds_left:02d} s"
    return f"{seconds_left} s"


class Progress:
    """One line a file: a live line on a terminal, a plain line in a log."""

    def __init__(self, files: int, total_bytes: int) -> None:
        self._files = files
        self._total_bytes = total_bytes
        self._started = time.monotonic()
        self._bytes = 0
        self._width = 0
        self._live = sys.stdout.isatty()

    def done(self, index: int, name: str, size: int, detail: str) -> None:
        self._bytes += size
        elapsed = time.monotonic() - self._started
        rate = self._bytes / elapsed if elapsed else 0
        left = (self._total_bytes - self._bytes) / rate if rate else 0
        text = (
            f"[{index}/{self._files}] {name}  {detail}  |  {100 * self._bytes / self._total_bytes:5.1f} %"
            f"  {self._bytes / 1e9:,.1f} / {self._total_bytes / 1e9:,.1f} GB"
            f"  {rate / 1e6:,.0f} MB/s  left: {format_duration(left)}"
        )
        if self._live:
            sys.stdout.write("\r" + text.ljust(self._width))
            self._width = max(self._width, len(text))
        else:
            sys.stdout.write(text + "\n")
        sys.stdout.flush()

    def finish(self) -> None:
        if self._live and self._width:
            sys.stdout.write("\n")
            sys.stdout.flush()


class Verifier:
    def __init__(self, folder: Path) -> None:
        self._folder = folder
        self._connection = duckdb.connect(config={"threads": THREADS})

    def files(self) -> list[Path]:
        wanted = [p for p in self._folder.iterdir() if p.is_file() and p.name != MANIFEST]
        return sorted(wanted, key=lambda p: (p.suffix != ".parquet", p.name))

    def inspect(self, path: Path) -> Entry:
        if path.suffix == ".parquet":
            return self._parquet(path)
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            while block := handle.read(1 << 24):
                digest.update(block)
        return Entry(path.name, "file", path.stat().st_size, None, digest.hexdigest())

    def _parquet(self, path: Path) -> Entry:
        # `hash` of every value of every column, added up: the order of the rows never matters.
        cursor = self._connection.execute(
            "SELECT COUNT(*) AS n, SUM(hash(COLUMNS(*))) FROM read_parquet(?)", [str(path)]
        )
        row = cursor.fetchone()
        assert row is not None
        rows, sums = int(row[0]), row[1:]
        checksum = sum(int(value or 0) for value in sums) & MASK
        return Entry(path.name, "parquet", path.stat().st_size, rows, f"{checksum:016x}")


def read_manifest(path: Path) -> dict[str, Entry]:
    with path.open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(line for line in handle if not line.startswith("#"))
        return {
            r["file"]: Entry(
                r["file"], r["kind"], int(r["bytes"]), int(r["rows"]) if r["rows"] else None, r["checksum"]
            )
            for r in rows
        }


def write_manifest(path: Path, entries: list[Entry]) -> None:
    rows = sum(e.rows or 0 for e in entries)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("# PRC Data Challenge 2024: size, rows and checksum of every file.\n")
        handle.write(f"# {len(entries)} files, {sum(e.size for e in entries)} bytes, {rows} rows.\n")
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["file", "kind", "bytes", "rows", "checksum"])
        for e in entries:
            writer.writerow([e.name, e.kind, e.size, "" if e.rows is None else e.rows, e.checksum])


def run(mode: str, folder: Path) -> int:
    if not folder.is_dir():
        print(f"{folder} is not a folder")
        return 2
    manifest_path = folder / MANIFEST
    expected: dict[str, Entry] = {}
    if mode == "check":
        if not manifest_path.is_file():
            print(f"No {MANIFEST} in {folder}: copy it with the data, or run `write` on the good folder")
            return 2
        expected = read_manifest(manifest_path)

    verifier = Verifier(folder)
    paths = verifier.files()
    progress = Progress(len(paths), sum(p.stat().st_size for p in paths))
    entries: list[Entry] = []
    problems: list[str] = []
    for index, path in enumerate(paths, start=1):
        try:
            entry = verifier.inspect(path)
        except Exception as error:  # noqa: BLE001 - a corrupt file must not stop the others
            problems.append(f"{path.name}: cannot be read ({str(error).splitlines()[0]})")
            progress.done(index, path.name, path.stat().st_size, "UNREADABLE")
            continue
        entries.append(entry)
        known = expected.get(entry.name)
        if mode == "check" and known and known != entry:
            problems.append(
                f"{entry.name}: {entry.size} bytes, {entry.rows} rows, {entry.checksum} "
                f"instead of {known.size}, {known.rows}, {known.checksum}"
            )
        rows = f"{entry.rows:,} rows" if entry.rows is not None else "sha256"
        progress.done(index, path.name, entry.size, f"{rows:>16}")
    progress.finish()

    if mode == "check":
        for name in sorted(set(expected) - {e.name for e in entries}):
            problems.append(f"{name}: missing from the folder")
        for name in sorted({e.name for e in entries} - set(expected)):
            problems.append(f"{name}: not in the manifest")
    total_rows = sum(e.rows or 0 for e in entries)
    print(f"{len(entries)} files, {sum(e.size for e in entries):,} bytes, {total_rows:,} rows.")
    if problems:
        print(f"{len(problems)} problem(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    if mode == "write":
        write_manifest(manifest_path, entries)
        print(f"Every file was read in full. Manifest written to {manifest_path}")
    else:
        print("The folder matches its manifest: nothing was lost or changed.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("mode", choices=["write", "check"])
    parser.add_argument("folder", type=Path)
    arguments = parser.parse_args()
    raise SystemExit(run(arguments.mode, arguments.folder))


if __name__ == "__main__":
    main()
