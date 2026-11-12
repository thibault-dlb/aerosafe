from datetime import date, timedelta
from pathlib import Path

import pytest

from services.collection.profiles import BoundingBox
from services.historical.prc2024 import (
    FLIGHT_ID_OFFSET,
    ICAO24_ADDRESSES,
    CleaningRules,
    FlightKey,
    Prc2024Archive,
    Prc2024Reader,
    icao24_from_flight_id,
)
from tests.historical_support import DAY, FLIGHT, OTHER_FLIGHT, Point, write_day

FRANCE = BoundingBox(41.3, 51.1, -5.2, 9.6)


def read(tmp_path: Path, points: list[Point], rules: CleaningRules | None = None):
    """Load a day and return the reader with its observations, as dictionaries."""
    reader = Prc2024Reader(FRANCE, rules)
    count = reader.load(write_day(tmp_path / f"{DAY}.parquet", points))
    segments = reader.segments()
    reader.attach(
        FlightKey(s.source_id, s.started_us, aircraft_id=7, flight_id=index)
        for index, s in enumerate(segments, start=1)
    )
    columns = (
        "aircraft_ids flight_ids observed_us longitudes latitudes altitudes speeds headings "
        "on_grounds"
    ).split()
    rows = [
        dict(zip(columns, values, strict=True))
        for batch in reader.batches(1000)
        for values in zip(*(getattr(batch, column) for column in columns), strict=True)
    ]
    return count, segments, rows


def at(minutes: int, seconds: int = 0) -> str:
    return f"{DAY} 10:{minutes:02d}:{seconds:02d}+00"


class TestIcao24:
    def test_the_code_is_six_lowercase_hexadecimal_characters(self) -> None:
        assert icao24_from_flight_id(FLIGHT_ID_OFFSET) == "000000"
        assert icao24_from_flight_id(FLIGHT_ID_OFFSET + 0xABCDEF) == "abcdef"
        assert icao24_from_flight_id(FLIGHT_ID_OFFSET + ICAO24_ADDRESSES - 1) == "ffffff"

    def test_two_flights_never_share_a_code(self) -> None:
        assert icao24_from_flight_id(FLIGHT) != icao24_from_flight_id(OTHER_FLIGHT)

    @pytest.mark.parametrize(
        "flight_id", [FLIGHT_ID_OFFSET - 1, FLIGHT_ID_OFFSET + ICAO24_ADDRESSES]
    )
    def test_an_identifier_outside_the_range_is_refused(self, flight_id: int) -> None:
        with pytest.raises(ValueError, match="does not fit"):
            icao24_from_flight_id(flight_id)

    def test_the_real_range_of_the_dataset_fits(self) -> None:
        assert icao24_from_flight_id(248_750_643)
        assert icao24_from_flight_id(258_074_492)


class TestCleaningRules:
    @pytest.mark.parametrize(
        "changes",
        [
            {"min_altitude_ft": 100.0, "max_altitude_ft": 100.0},
            {"max_speed_kt": 0.0},
            {"ground_speed_kt": 0.0},
            {"flight_gap": timedelta(0)},
        ],
    )
    def test_invalid_rules_are_refused(self, changes: dict) -> None:
        with pytest.raises(ValueError):
            CleaningRules(**changes)


class TestArea:
    def test_only_the_points_inside_the_area_are_kept(self, tmp_path: Path) -> None:
        count, _, rows = read(
            tmp_path,
            [
                Point(at=at(0), latitude=48.5, longitude=2.5),
                Point(at=at(0, 1), latitude=41.3, longitude=-5.2),  # the corner is inside
                Point(at=at(0, 2), latitude=51.2, longitude=2.5),  # north of the area
                Point(at=at(0, 3), latitude=48.5, longitude=9.7),  # east of the area
                Point(at=at(0, 4), latitude=-33.9, longitude=18.4),  # another continent
            ],
        )

        assert count == 2
        assert [row["latitudes"] for row in rows] == [48.5, 41.3]

    def test_a_file_without_a_point_in_the_area_gives_nothing(self, tmp_path: Path) -> None:
        count, segments, rows = read(tmp_path, [Point(latitude=10.0, longitude=100.0)])

        assert (count, segments, rows) == (0, [], [])

    def test_the_coordinates_are_rounded_to_six_decimals(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(latitude=48.12345678, longitude=2.98765432)])

        assert (rows[0]["latitudes"], rows[0]["longitudes"]) == (48.123457, 2.987654)


class TestUnits:
    def test_the_measures_are_converted_to_metres_and_metres_per_second(
        self, tmp_path: Path
    ) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=10_000, groundspeed=400, track=123.456)])

        assert rows[0]["altitudes"] == 3048.0
        assert rows[0]["speeds"] == 205.78
        assert rows[0]["headings"] == 123.46

    def test_a_heading_that_rounds_to_360_becomes_0(self, tmp_path: Path) -> None:
        _, _, rows = read(
            tmp_path,
            [Point(at=at(0), track=359.996), Point(at=at(0, 1), track=360.0)],
        )

        assert [row["headings"] for row in rows] == [0.0, 0.0]

    def test_the_time_is_in_microseconds_since_the_epoch(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(at="2022-07-01 10:00:00+00")])

        assert rows[0]["observed_us"] == 1_656_669_600_000_000


class TestCleaning:
    @pytest.mark.parametrize("altitude", [60_000.1, -500.1, 105_000.0])
    def test_an_impossible_altitude_is_emptied_and_the_point_is_kept(
        self, tmp_path: Path, altitude: float
    ) -> None:
        count, _, rows = read(tmp_path, [Point(altitude=altitude)])

        assert count == 1
        assert rows[0]["altitudes"] is None
        assert rows[0]["speeds"] is not None

    @pytest.mark.parametrize("altitude", [60_000.0, -500.0])
    def test_the_limits_of_the_altitude_are_valid(self, tmp_path: Path, altitude: float) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=altitude)])

        assert rows[0]["altitudes"] is not None

    @pytest.mark.parametrize("speed", [700.1, 3_921.0, -1.0])
    def test_an_impossible_speed_is_emptied(self, tmp_path: Path, speed: float) -> None:
        _, _, rows = read(tmp_path, [Point(groundspeed=speed)])

        assert rows[0]["speeds"] is None
        assert rows[0]["altitudes"] is not None

    def test_a_missing_speed_or_heading_stays_missing(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(groundspeed=None, track=None)])

        assert (rows[0]["speeds"], rows[0]["headings"]) == (None, None)

    @pytest.mark.parametrize("track", [-0.1, 360.1, 720.0])
    def test_a_heading_outside_0_to_360_is_emptied(self, tmp_path: Path, track: float) -> None:
        _, _, rows = read(tmp_path, [Point(track=track)])

        assert rows[0]["headings"] is None

    def test_a_point_without_altitude_is_kept(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=None)])

        assert rows[0]["altitudes"] is None
        assert rows[0]["on_grounds"] is False

    def test_the_same_instant_twice_is_stored_once(self, tmp_path: Path) -> None:
        count, _, rows = read(tmp_path, [Point(at=at(0)), Point(at=at(0), latitude=49.0)])

        assert (count, len(rows)) == (1, 1)


class TestOnGround:
    def test_a_slow_low_point_is_on_the_ground_and_keeps_its_speed(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=500, groundspeed=10)])

        assert rows[0]["on_grounds"] is True
        assert rows[0]["speeds"] == 5.14

    def test_a_fast_point_is_airborne_even_when_it_is_low(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=500, groundspeed=150)])

        assert rows[0]["on_grounds"] is False

    def test_a_slow_point_at_altitude_is_airborne_and_its_speed_is_a_glitch(
        self, tmp_path: Path
    ) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=18_000, groundspeed=5)])

        assert rows[0]["on_grounds"] is False
        assert rows[0]["speeds"] is None

    def test_a_point_without_speed_is_never_on_the_ground(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point(altitude=100, groundspeed=None)])

        assert rows[0]["on_grounds"] is False

    def test_the_thresholds_can_be_changed(self, tmp_path: Path) -> None:
        rules = CleaningRules(ground_speed_kt=100, ground_altitude_ft=1_000)

        _, _, rows = read(tmp_path, [Point(altitude=500, groundspeed=80)], rules)

        assert rows[0]["on_grounds"] is True


class TestFlights:
    def test_points_less_than_the_gap_apart_make_one_flight(self, tmp_path: Path) -> None:
        _, segments, _ = read(
            tmp_path,
            [Point(at=at(0)), Point(at=at(30)), Point(at=at(59))],  # exactly 30 min is allowed
        )

        assert len(segments) == 1
        assert segments[0].points == 3
        assert segments[0].ended_us - segments[0].started_us == 59 * 60 * 1_000_000

    def test_a_longer_gap_starts_a_new_flight(self, tmp_path: Path) -> None:
        _, segments, rows = read(
            tmp_path,
            [Point(at=at(0)), Point(at=at(1)), Point(at=at(32)), Point(at=at(33))],
        )

        assert [(s.points, s.source_id) for s in segments] == [(2, FLIGHT), (2, FLIGHT)]
        assert segments[1].started_us - segments[0].started_us == 32 * 60 * 1_000_000
        assert [row["flight_ids"] for row in rows] == [1, 1, 2, 2]

    def test_an_aircraft_leaving_the_area_and_coming_back_later_starts_a_new_flight(
        self, tmp_path: Path
    ) -> None:
        _, segments, _ = read(
            tmp_path,
            [
                Point(at=at(0)),
                Point(at=at(10), latitude=60.0),  # outside the area: not read
                Point(at=at(50)),
            ],
        )

        assert len(segments) == 2

    def test_each_aircraft_has_its_own_flights(self, tmp_path: Path) -> None:
        _, segments, _ = read(
            tmp_path,
            [
                Point(flight_id=OTHER_FLIGHT, at=at(0)),
                Point(flight_id=FLIGHT, at=at(0)),
                Point(flight_id=FLIGHT, at=at(1)),
            ],
        )

        assert [(s.source_id, s.points) for s in segments] == [(FLIGHT, 2), (OTHER_FLIGHT, 1)]


class TestBatches:
    def test_the_rows_come_flight_after_flight_in_time_order(self, tmp_path: Path) -> None:
        _, _, rows = read(
            tmp_path,
            [
                Point(flight_id=OTHER_FLIGHT, at=at(0, 5)),
                Point(flight_id=FLIGHT, at=at(0, 2)),
                Point(flight_id=FLIGHT, at=at(0, 1)),
                Point(flight_id=OTHER_FLIGHT, at=at(0, 4)),
            ],
        )

        seconds = [row["observed_us"] // 1_000_000 % 60 for row in rows]
        assert seconds == [1, 2, 4, 5]

    def test_the_rows_carry_the_keys_given_to_the_reader(self, tmp_path: Path) -> None:
        _, _, rows = read(tmp_path, [Point()])

        assert (rows[0]["aircraft_ids"], rows[0]["flight_ids"]) == (7, 1)

    def test_the_batches_are_cut_at_the_requested_size(self, tmp_path: Path) -> None:
        reader = Prc2024Reader(FRANCE)
        reader.load(write_day(tmp_path / f"{DAY}.parquet", [Point(at=at(0, s)) for s in range(5)]))
        reader.attach(FlightKey(s.source_id, s.started_us, 7, 1) for s in reader.segments())

        sizes = [len(batch) for batch in reader.batches(2)]

        assert sizes == [2, 2, 1]

    def test_a_batch_size_must_be_positive(self) -> None:
        reader = Prc2024Reader(FRANCE)

        with pytest.raises(ValueError, match="positive"):
            next(reader.batches(0))

    def test_a_second_file_replaces_the_first(self, tmp_path: Path) -> None:
        reader = Prc2024Reader(FRANCE)
        reader.load(write_day(tmp_path / "2022-07-01.parquet", [Point(), Point(at=at(0, 1))]))

        count = reader.load(write_day(tmp_path / "2022-07-02.parquet", [Point(at=at(5))]))

        assert count == 1
        assert [s.points for s in reader.segments()] == [1]

    def test_the_threads_of_duckdb_are_limited(self, tmp_path: Path) -> None:
        reader = Prc2024Reader(FRANCE, threads=1)

        assert reader.load(write_day(tmp_path / f"{DAY}.parquet", [Point()])) == 1
        reader.close()

    def test_duckdb_needs_at_least_one_thread(self) -> None:
        with pytest.raises(ValueError, match="at least one thread"):
            Prc2024Reader(FRANCE, threads=0)

    def test_the_reader_works_as_a_context_manager(self, tmp_path: Path) -> None:
        with Prc2024Reader(FRANCE) as reader:
            assert reader.load(write_day(tmp_path / f"{DAY}.parquet", [Point()])) == 1


class TestArchive:
    def make(self, tmp_path: Path) -> Prc2024Archive:
        for name in ("2022-07-03", "2022-07-01", "2022-07-02", "2022-08-15"):
            (tmp_path / f"{name}.parquet").touch()
        (tmp_path / "flight_list.csv").touch()
        (tmp_path / "README.txt").touch()
        (tmp_path / "notes.parquet").touch()
        return Prc2024Archive(tmp_path)

    def test_the_days_come_oldest_first_and_other_files_are_ignored(self, tmp_path: Path) -> None:
        names = [path.name for path in self.make(tmp_path).day_files()]

        assert names == [
            "2022-07-01.parquet",
            "2022-07-02.parquet",
            "2022-07-03.parquet",
            "2022-08-15.parquet",
        ]

    def test_the_period_includes_both_ends(self, tmp_path: Path) -> None:
        archive = self.make(tmp_path)

        names = [p.name for p in archive.day_files(date(2022, 7, 2), date(2022, 7, 3))]

        assert names == ["2022-07-02.parquet", "2022-07-03.parquet"]

    def test_an_open_end_goes_to_the_last_or_the_first_day(self, tmp_path: Path) -> None:
        archive = self.make(tmp_path)

        assert len(archive.day_files(first=date(2022, 7, 3))) == 2
        assert len(archive.day_files(last=date(2022, 7, 1))) == 1

    def test_a_missing_folder_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError):
            Prc2024Archive(tmp_path / "absent")
