import math

import pytest

from services.collection.profiles import BoundingBox
from services.historical.areas import (
    AREA_NAMES,
    CELL_DEGREES,
    NAMED_AREAS,
    Area,
    Run,
    parse_runs,
)

HEADER = "row,first,last"


def contains(area: Area, latitude: float, longitude: float) -> bool:
    """Whether the cell of a point is one of the cells of the mask."""
    row = math.floor(latitude / CELL_DEGREES)
    column = math.floor(longitude / CELL_DEGREES)
    return any(r.row == row and r.first <= column <= r.last for r in area.runs or ())


@pytest.fixture(scope="module")
def france() -> Area:
    return Area.named("france-100km")


class TestParseRuns:
    def test_the_runs_are_read_after_the_header(self) -> None:
        text = f"{HEADER}\n4850,240,260\n4851,241,259\n"

        assert parse_runs(text) == (Run(4850, 240, 260), Run(4851, 241, 259))

    def test_comments_and_blank_lines_are_ignored(self) -> None:
        text = f"# a comment\n\n{HEADER}\n# in the middle\n4850,240,260\n\n"

        assert parse_runs(text) == (Run(4850, 240, 260),)

    def test_negative_columns_are_allowed_west_of_greenwich(self) -> None:
        assert parse_runs(f"{HEADER}\n4850,-649,-600\n") == (Run(4850, -649, -600),)

    def test_a_file_without_a_header_is_refused(self) -> None:
        with pytest.raises(ValueError, match="no header"):
            parse_runs("# only a comment\n")

    def test_a_wrong_header_is_refused_with_its_line_number(self) -> None:
        with pytest.raises(ValueError, match="Line 2: expected the header"):
            parse_runs("# comment\nrow,start,end\n")

    @pytest.mark.parametrize("line", ["4850,240", "4850,a,260", "4850,240,260,1", "x"])
    def test_a_line_that_is_not_three_whole_numbers_is_refused(self, line: str) -> None:
        with pytest.raises(ValueError, match="Line 2: expected three whole numbers"):
            parse_runs(f"{HEADER}\n{line}\n")


class TestMask:
    def test_the_bounds_are_those_of_the_cells(self) -> None:
        area = Area.from_runs("test", "a test", [Run(4850, 240, 260), Run(4851, 235, 270)])

        assert area.bounds == BoundingBox(48.5, 48.52, 2.35, 2.71)
        assert area.is_mask is True
        assert area.cell_count() == 21 + 36

    def test_a_mask_needs_a_cell(self) -> None:
        with pytest.raises(ValueError, match="at least one run"):
            Area.from_runs("test", "a test", [])

    def test_a_run_cannot_end_before_it_starts(self) -> None:
        with pytest.raises(ValueError, match="after"):
            Area.from_runs("test", "a test", [Run(4850, 260, 240)])

    @pytest.mark.parametrize(
        "runs",
        [
            [Run(4850, 240, 260), Run(4850, 255, 270)],  # overlap in a row
            [Run(4850, 240, 260), Run(4850, 260, 270)],  # the same cell twice
            [Run(4851, 240, 260), Run(4850, 240, 260)],  # rows out of order
            [Run(4850, 250, 260), Run(4850, 240, 245)],  # runs of a row out of order
        ],
    )
    def test_runs_that_overlap_or_are_out_of_order_are_refused(self, runs: list[Run]) -> None:
        with pytest.raises(ValueError, match="overlaps the previous one or is out of order"):
            Area.from_runs("test", "a test", runs)

    def test_two_runs_in_a_row_with_a_gap_are_fine(self) -> None:
        area = Area.from_runs("test", "a test", [Run(4850, 240, 245), Run(4850, 250, 255)])

        assert area.cell_count() == 12


class TestRectangle:
    def test_a_rectangle_has_no_cells(self) -> None:
        area = Area.rectangle(BoundingBox(41.3, 51.1, -5.2, 9.6))

        assert (area.is_mask, area.runs, area.cell_count()) == (False, None, 0)
        assert area.bounds == BoundingBox(41.3, 51.1, -5.2, 9.6)

    def test_the_description_gives_the_corners(self) -> None:
        description = Area.rectangle(BoundingBox(41.3, 51.1, -5.2, 9.6)).description

        assert description == "rectangle, latitude 41.3 to 51.1, longitude -5.2 to 9.6"


class TestShippedAreas:
    def test_every_named_area_has_a_file_that_loads(self) -> None:
        for name in AREA_NAMES:
            area = Area.named(name)
            assert area.name == name
            assert area.description == NAMED_AREAS[name][0]
            assert area.is_mask

    def test_the_names_are_those_of_the_command_line(self) -> None:
        assert AREA_NAMES == ("france-100km",)

    def test_an_unknown_name_is_refused_with_the_known_ones(self) -> None:
        with pytest.raises(ValueError, match="Unknown area 'spain'; known areas: france-100km"):
            Area.named("spain")

    def test_the_mask_of_france_has_the_expected_extent(self, france: Area) -> None:
        bounds = france.bounds

        assert 41.3 < bounds.lat_min < 41.6 and 51.8 < bounds.lat_max < 52.2
        assert -6.7 < bounds.lon_min < -6.3 and 9.4 < bounds.lon_max < 9.8
        # About 954 000 km2 at about 0.87 km2 a cell.
        assert 1_050_000 < france.cell_count() < 1_200_000

    @pytest.mark.parametrize(
        ("place", "latitude", "longitude"),
        [
            ("Paris", 48.8566, 2.3522),
            ("Lyon", 45.7640, 4.8357),
            ("Marseille", 43.2965, 5.3698),
            ("Brest", 48.3904, -4.4861),
            ("Strasbourg", 48.5734, 7.7521),
            ("Brussels, less than 100 km from the border", 50.8503, 4.3517),
            ("the sea 50 km off Brest", 48.4, -5.6),
        ],
    )
    def test_the_places_in_or_near_france_are_kept(
        self, france: Area, place: str, latitude: float, longitude: float
    ) -> None:
        assert contains(france, latitude, longitude), place

    @pytest.mark.parametrize(
        ("place", "latitude", "longitude"),
        [
            ("Ajaccio, in Corsica", 41.9192, 8.7386),
            ("Bastia, in Corsica", 42.6977, 9.4509),
            ("London", 51.5072, -0.1276),
            ("Madrid", 40.4168, -3.7038),
            ("Rome", 41.9028, 12.4964),
            ("the Atlantic 200 km off Brittany", 48.4, -8.0),
            ("Frankfurt, more than 100 km from the border", 50.1109, 8.6821),
        ],
    )
    def test_the_places_far_from_the_mainland_and_corsica_are_dropped(
        self, france: Area, place: str, latitude: float, longitude: float
    ) -> None:
        assert not contains(france, latitude, longitude), place

    def test_the_mask_is_one_piece_from_south_to_north(self, france: Area) -> None:
        rows = [run.row for run in france.runs or ()]

        assert rows == sorted(rows)
        assert rows[-1] - rows[0] + 1 == len(set(rows))  # every row of the extent is there
