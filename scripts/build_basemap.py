# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2.0"]
# ///
"""Build the data of the map drawn by the front end (docs/technology-choices.md).

The map has no tile: it draws coasts, borders, rivers, lakes, urban areas and airports from
small files shipped with the front end. This script makes them from free data, and is only run
again to change the map. Run it from the root of the repository, nothing else is needed (uv
reads the dependencies above):

    uv run scripts/build_basemap.py

Sources (public domain): Natural Earth 10 m (countries, rivers, lakes, urban areas) and
OurAirports (airports and runways). The outline of the area of the historical data is the
union of the cells of `services/historical/areas/france_100km.csv`, so the map shows exactly
what the import keeps. Written to `src/front/src/assets/map/`.
"""

import argparse
import csv
import json
import time
import urllib.request
from collections.abc import Callable
from pathlib import Path
from tempfile import gettempdir

from shapely.geometry import box
from shapely.ops import unary_union

NATURAL_EARTH = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/"
SOURCES = {
    "countries": NATURAL_EARTH + "ne_10m_admin_0_countries.geojson",
    "rivers": NATURAL_EARTH + "ne_10m_rivers_lake_centerlines.geojson",
    "lakes": NATURAL_EARTH + "ne_10m_lakes.geojson",
    "urban": NATURAL_EARTH + "ne_10m_urban_areas.geojson",
    "airports": OURAIRPORTS + "airports.csv",
    "runways": OURAIRPORTS + "runways.csv",
}
MASK = Path("src/api/services/historical/areas/france_100km.csv")
OUTPUT = Path("src/front/src/assets/map")
CELL_DEGREES = 0.01
# Western Europe: what a map of the French airspace can show.
WEST, SOUTH, EAST, NORTH = -9.0, 39.5, 13.0, 54.0
Point = tuple[float, float]


def download(name: str, url: str, folder: Path, index: int, total: int) -> Path:
    """Fetch one source into the cache folder, with live progress."""
    target = folder / f"{name}{Path(url).suffix}"
    if target.exists() and target.stat().st_size > 0:
        print(f"[1/4 download] {index}/{total} {name}: already there", flush=True)
        return target
    started = time.time()
    request = urllib.request.Request(url, headers={"User-Agent": "aerosafe-basemap"})
    with urllib.request.urlopen(request, timeout=120) as response, open(target, "wb") as out:
        size = int(response.headers.get("Content-Length") or 0)
        done = 0
        while chunk := response.read(1 << 18):
            out.write(chunk)
            done += len(chunk)
            speed = done / 1e6 / max(time.time() - started, 0.01)
            percent = f"{100 * done / size:5.1f} %" if size else "    ? %"
            print(
                f"[1/4 download] {index}/{total} {name}: {done / 1e6:6.1f} MB {percent} "
                f"{speed:5.1f} MB/s",
                end="\r",
                flush=True,
            )
    print(f"[1/4 download] {index}/{total} {name}: {done / 1e6:.1f} MB" + " " * 30, flush=True)
    return target


def simplify(points: list[Point], tolerance: float) -> list[Point]:
    """Douglas-Peucker, without recursion."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        ax, ay = points[first]
        dx, dy = points[last][0] - ax, points[last][1] - ay
        norm = dx * dx + dy * dy
        worst, where = 0.0, -1
        for i in range(first + 1, last):
            px, py = points[i]
            if norm == 0:
                distance = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / norm))
                distance = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if distance > worst:
                worst, where = distance, i
        if worst > tolerance * tolerance:
            keep[where] = True
            stack.extend([(first, where), (where, last)])
    return [p for p, kept in zip(points, keep, strict=True) if kept]


def in_frame(line: list[Point]) -> bool:
    xs = [p[0] for p in line]
    ys = [p[1] for p in line]
    return max(xs) >= WEST and min(xs) <= EAST and max(ys) >= SOUTH and min(ys) <= NORTH


def tidy(line: list, tolerance: float, ring: bool) -> list[list[float]] | None:
    kept = simplify([(p[0], p[1]) for p in line], tolerance)
    out = [[round(x, 3), round(y, 3)] for x, y in kept]
    return out if len(out) >= (4 if ring else 2) else None


def features(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def rings(path: Path, tolerance: float, keep: Callable[[dict], bool] = lambda _: True) -> list:
    """The outer rings of the polygons that touch the frame."""
    found = []
    for feature in features(path):
        geometry = feature["geometry"]
        if not geometry or not keep(feature["properties"]):
            continue
        parts = (
            geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        )
        for part in parts:
            if in_frame(part[0]) and (ring := tidy(part[0], tolerance, True)):
                found.append(ring)
    return found


def lines(path: Path, tolerance: float, keep: Callable[[dict], bool]) -> list:
    found = []
    for feature in features(path):
        geometry = feature["geometry"]
        if not geometry or not keep(feature["properties"]):
            continue
        parts = (
            geometry["coordinates"]
            if geometry["type"] == "MultiLineString"
            else [geometry["coordinates"]]
        )
        for part in parts:
            if in_frame(part) and (line := tidy(part, tolerance, False)):
                found.append(line)
    return found


def outline() -> list:
    """The border of the area of the historical data, from the cells of its mask."""
    cells = []
    for line in MASK.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line == "row,first,last":
            continue
        row, first, last = (int(part) for part in line.split(","))
        cells.append(
            box(
                first * CELL_DEGREES,
                row * CELL_DEGREES,
                (last + 1) * CELL_DEGREES,
                (row + 1) * CELL_DEGREES,
            )
        )
    shape = unary_union(cells).simplify(0.01)
    parts = list(shape.geoms) if shape.geom_type == "MultiPolygon" else [shape]
    return [[[round(x, 3), round(y, 3)] for x, y in part.exterior.coords] for part in parts]


def airports(airports_csv: Path, runways_csv: Path) -> list[dict]:
    """Large airports and the medium ones with scheduled flights, with their runways."""
    found: dict[str, dict] = {}
    with airports_csv.open(encoding="utf-8") as file:
        for row in csv.DictReader(file):
            kind = row["type"]
            if kind not in ("large_airport", "medium_airport") or len(row["ident"]) != 4:
                continue
            if kind == "medium_airport" and row["scheduled_service"] != "yes":
                continue
            lat, lon = float(row["latitude_deg"]), float(row["longitude_deg"])
            if WEST <= lon <= EAST and SOUTH <= lat <= NORTH:
                found[row["ident"]] = {
                    "icao": row["ident"],
                    "name": row["name"],
                    "lat": round(lat, 4),
                    "lon": round(lon, 4),
                    "large": kind == "large_airport",
                    "runways": [],
                }
    with runways_csv.open(encoding="utf-8") as file:
        for row in csv.DictReader(file):
            airport = found.get(row["airport_ident"])
            if not airport or row["closed"] == "1":
                continue
            try:
                ends = [
                    float(row[key])
                    for key in ("le_latitude_deg", "le_longitude_deg", "he_latitude_deg", "he_longitude_deg")
                ]
            except ValueError:
                continue
            airport["runways"].append([round(value, 4) for value in ends])
    return sorted(found.values(), key=lambda airport: airport["icao"])


def write(name: str, data: object) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    (OUTPUT / name).write_text(text + "\n", encoding="utf-8")
    print(f"[4/4 write] {name}: {len(text) / 1e3:.0f} kB", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, default=Path(gettempdir()) / "aerosafe-basemap")
    folder = parser.parse_args().cache
    folder.mkdir(parents=True, exist_ok=True)

    files = {
        name: download(name, url, folder, index, len(SOURCES))
        for index, (name, url) in enumerate(SOURCES.items(), start=1)
    }

    print("[2/4 reduce] land, borders, water, urban areas", flush=True)
    land = rings(files["countries"], 0.004)
    lakes = rings(files["lakes"], 0.004)
    urban = rings(files["urban"], 0.004)
    rivers = lines(files["rivers"], 0.004, lambda properties: (properties.get("scalerank") or 9) <= 7)
    print(
        f"[2/4 reduce] {len(land)} land, {len(lakes)} lakes, {len(urban)} urban, {len(rivers)} rivers",
        flush=True,
    )

    print("[3/4 airports and area]", flush=True)
    places = airports(files["airports"], files["runways"])
    area = outline()
    print(f"[3/4 airports and area] {len(places)} airports, area of {len(area)} part(s)", flush=True)

    write("basemap.json", {"land": land, "lakes": lakes, "urban": urban, "rivers": rivers, "area": area})
    write("airports.json", places)


if __name__ == "__main__":
    main()
