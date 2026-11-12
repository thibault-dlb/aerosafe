"""The areas the import can keep: a rectangle, or a mask of small cells that follows a border.

A mask is a grid of cells of 0.01 degree (about 1 km). The cell of a point is
`(floor(latitude / 0.01), floor(longitude / 0.01))`, and a mask lists the cells it keeps as runs:
for one row, the columns from `first` to `last`. A mask is built once from a polygon by
`scripts/build_area_mask.py` and shipped as a small CSV file, so that the import needs no
geometry library: DuckDB joins the points with the cells.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from importlib import resources

from services.collection.profiles import BoundingBox

CELL_DEGREES = 0.01

# Name used on the command line: (description, file of the mask in the `areas` folder).
NAMED_AREAS: dict[str, tuple[str, str]] = {
    "france-100km": ("France without Corsica, plus 100 km all around", "france_100km.csv"),
}
AREA_NAMES = tuple(NAMED_AREAS)


@dataclass(frozen=True)
class Run:
    """The cells of one row of the grid, from the column `first` to the column `last`."""

    row: int
    first: int
    last: int


def parse_runs(text: str) -> tuple[Run, ...]:
    """Read the runs of a mask file: a `row,first,last` header, then one run a line.

    Blank lines and lines starting with `#` are comments.
    """
    runs: list[Run] = []
    header_seen = False
    for number, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if not header_seen:
            if line != "row,first,last":
                raise ValueError(f"Line {number}: expected the header row,first,last")
            header_seen = True
            continue
        try:
            row, first, last = (int(part) for part in line.split(","))
        except ValueError:
            raise ValueError(f"Line {number}: expected three whole numbers, got {line!r}") from None
        runs.append(Run(row, first, last))
    if not header_seen:
        raise ValueError("The mask has no header row,first,last")
    return tuple(runs)


@dataclass(frozen=True)
class Area:
    """What the import keeps: the points inside `bounds` and, for a mask, inside its cells.

    `bounds` is always set: it lets DuckDB skip the parquet blocks outside the area before
    the join with the cells.
    """

    name: str
    description: str
    bounds: BoundingBox
    runs: tuple[Run, ...] | None = None

    @property
    def is_mask(self) -> bool:
        return self.runs is not None

    @classmethod
    def rectangle(cls, bounds: BoundingBox) -> "Area":
        description = (
            f"rectangle, latitude {bounds.lat_min} to {bounds.lat_max}, "
            f"longitude {bounds.lon_min} to {bounds.lon_max}"
        )
        return cls("rectangle", description, bounds)

    @classmethod
    def from_runs(cls, name: str, description: str, runs: Iterable[Run]) -> "Area":
        """A mask. The runs must be sorted and never overlap: a cell is kept once."""
        kept = tuple(runs)
        if not kept:
            raise ValueError("A mask needs at least one run")
        previous: Run | None = None
        for run in kept:
            if run.first > run.last:
                raise ValueError(f"Run of row {run.row}: first column {run.first} after {run.last}")
            if previous and (run.row, run.first) <= (previous.row, previous.last):
                raise ValueError(
                    f"Run of row {run.row} starting at {run.first} overlaps the previous one "
                    "or is out of order"
                )
            previous = run
        bounds = BoundingBox(
            lat_min=round(min(r.row for r in kept) * CELL_DEGREES, 2),
            lat_max=round((max(r.row for r in kept) + 1) * CELL_DEGREES, 2),
            lon_min=round(min(r.first for r in kept) * CELL_DEGREES, 2),
            lon_max=round((max(r.last for r in kept) + 1) * CELL_DEGREES, 2),
        )
        return cls(name, description, bounds, kept)

    @classmethod
    def named(cls, name: str) -> "Area":
        """One of the areas shipped with the import, by its name on the command line."""
        if name not in NAMED_AREAS:
            raise ValueError(f"Unknown area {name!r}; known areas: {', '.join(AREA_NAMES)}")
        description, filename = NAMED_AREAS[name]
        text = resources.files(__package__).joinpath("areas", filename).read_text(encoding="utf-8")
        return cls.from_runs(name, description, parse_runs(text))

    def cell_count(self) -> int:
        """How many cells the mask keeps; 0 for a rectangle, which has none."""
        return sum(run.last - run.first + 1 for run in self.runs or ())
