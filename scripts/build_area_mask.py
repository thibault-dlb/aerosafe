# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pyproj>=3.6", "shapely>=2.0"]
# ///
"""Build the mask of cells of an area of the historical import (docs/historical-data.md).

The area is metropolitan France without Corsica, plus a distance all around. The border comes
from Natural Earth (10 m, public domain). It is widened in metres, in the Lambert-93 projection
(EPSG:2154), then cut into cells of 0.01 degree. The cells whose centre is inside are written as
runs (a row, a first and a last column), the format of `services/historical/areas.py`.

Run from the root of the repository, nothing else is needed (uv reads the dependencies above):

    uv run scripts/build_area_mask.py --km 100

The mask is a data file of the repository, so this script is only run again to change the area.
"""

import argparse
import json
import shutil
import tempfile
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import unary_union

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
    "ne_10m_admin_0_countries.geojson"
)
CELL_DEGREES = 0.01
OUTPUT_FOLDER = Path("src/api/services/historical/areas")


def reproject(geometry: shapely.Geometry, transformer: Transformer) -> shapely.Geometry:
    """The same geometry in another coordinate system."""
    return shapely.transform(
        geometry, lambda xy: np.column_stack(transformer.transform(xy[:, 0], xy[:, 1]))
    )


class AreaBuilder:
    """Turns the border of France into a mask of cells."""

    def __init__(self, source: Path, kilometres: float) -> None:
        self._source = source
        self._kilometres = kilometres

    def polygon(self) -> shapely.Geometry:
        """Mainland France and its islands, without Corsica, widened, in degrees."""
        collection = json.loads(self._source.read_text(encoding="utf-8"))
        france = next(f for f in collection["features"] if f["properties"]["ADMIN"] == "France")
        mainland, corsica = [], []
        for part in shape(france["geometry"]).geoms:
            point = part.representative_point()
            # The overseas territories are far from Europe. Corsica is east of 8.2 degrees and
            # south of 43.3 degrees; the mainland ends near 7.7.
            if -10 <= point.x <= 12 and 40 <= point.y <= 52:
                (corsica if point.x > 8.2 and point.y < 43.3 else mainland).append(part)
        to_metres = Transformer.from_crs(4326, 2154, always_xy=True)
        to_degrees = Transformer.from_crs(2154, 4326, always_xy=True)
        widened = reproject(unary_union(mainland), to_metres).buffer(
            self._kilometres * 1000, quad_segs=16
        )
        # The widened border may reach Corsica when the distance is large: cut it out.
        widened = widened.difference(reproject(unary_union(corsica), to_metres))
        return reproject(widened, to_degrees)

    @staticmethod
    def runs(polygon: shapely.Geometry) -> list[tuple[int, int, int]]:
        """The cells whose centre is inside the polygon, as (row, first column, last column)."""
        min_x, min_y, max_x, max_y = polygon.bounds
        first_row, last_row = int(np.floor(min_y / CELL_DEGREES)), int(np.floor(max_y / CELL_DEGREES))
        first_col, last_col = int(np.floor(min_x / CELL_DEGREES)), int(np.floor(max_x / CELL_DEGREES))
        columns = np.arange(first_col, last_col + 1)
        longitudes = (columns + 0.5) * CELL_DEGREES
        shapely.prepare(polygon)
        runs: list[tuple[int, int, int]] = []
        for row in range(first_row, last_row + 1):
            latitudes = np.full(longitudes.shape, (row + 0.5) * CELL_DEGREES)
            inside = shapely.contains_xy(polygon, longitudes, latitudes).astype(np.int8)
            edges = np.flatnonzero(np.diff(np.concatenate(([0], inside, [0]))))
            for start, end in zip(edges[::2], edges[1::2], strict=True):
                runs.append((row, int(columns[start]), int(columns[end - 1])))
        return runs


def write(path: Path, runs: list[tuple[int, int, int]], kilometres: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# Metropolitan France without Corsica, plus {kilometres:g} km all around.",
        "# Cells of 0.01 degree: row = floor(latitude / 0.01), column = floor(longitude / 0.01).",
        "# Source: Natural Earth 10 m admin-0 countries (public domain), widened in Lambert-93.",
        f"# Built on {date.today().isoformat()} by scripts/build_area_mask.py --km {kilometres:g}.",
        "row,first,last",
        *(f"{row},{first},{last}" for row, first, last in runs),
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--km", type=float, default=100, help="distance around the border")
    parser.add_argument("--source", type=Path, help="Natural Earth file; downloaded when omitted")
    parser.add_argument("--output", type=Path, help="mask file; default: in the areas folder")
    arguments = parser.parse_args()

    folder = None
    source = arguments.source
    if source is None:
        # A fresh folder of its own for the download, removed at the end.
        folder = Path(tempfile.mkdtemp(prefix="natural-earth-"))
        source = folder / "countries.geojson"
        print(f"Downloading {SOURCE_URL}")
        urllib.request.urlretrieve(SOURCE_URL, source)
    try:
        builder = AreaBuilder(source, arguments.km)
        polygon = builder.polygon()
        runs = builder.runs(polygon)
    finally:
        if folder:
            shutil.rmtree(folder, ignore_errors=True)

    output = arguments.output or OUTPUT_FOLDER / f"france_{arguments.km:g}km.csv"
    write(output, runs, arguments.km)
    cells = sum(last - first + 1 for _, first, last in runs)
    print(f"{len(runs):,} runs, {cells:,} cells, written to {output}")


if __name__ == "__main__":
    main()
