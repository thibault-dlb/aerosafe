from pathlib import Path

import pytest

from services.collection.profiles import BoundingBox
from services.historical.importer import (
    HistoricalImporter,
    HistoricalImportError,
    Phase,
    Progress,
)
from services.historical.prc2024 import ObservationBatch, Prc2024Reader, icao24_from_flight_id
from tests.historical_support import (
    DAY,
    FLIGHT,
    OTHER_FLIGHT,
    FakeSink,
    Point,
    write_day,
)

FRANCE = BoundingBox(41.3, 51.1, -5.2, 9.6)


def at(minutes: int, seconds: int = 0) -> str:
    return f"{DAY} 10:{minutes:02d}:{seconds:02d}+00"


class LossySink(FakeSink):
    """A database that accepts the rows and keeps none of them."""

    async def insert_observations(self, batch: ObservationBatch) -> int:
        self.calls.append("insert_observations")
        return 0


@pytest.fixture
def reader() -> Prc2024Reader:
    return Prc2024Reader(FRANCE)


@pytest.fixture
def day(tmp_path: Path) -> Path:
    return write_day(
        tmp_path / f"{DAY}.parquet",
        [
            Point(flight_id=FLIGHT, at=at(0)),
            Point(flight_id=FLIGHT, at=at(1)),
            Point(flight_id=FLIGHT, at=at(40)),  # more than 30 minutes later: a second flight
            Point(flight_id=OTHER_FLIGHT, at=at(0)),
            Point(flight_id=OTHER_FLIGHT, at=at(0), latitude=10.0),  # outside the area
        ],
    )


async def test_a_file_becomes_aircraft_flights_and_observations(
    reader: Prc2024Reader, day: Path
) -> None:
    sink = FakeSink()

    report = await HistoricalImporter(reader).import_file(sink, day)

    assert sink.aircraft.keys() == {
        icao24_from_flight_id(FLIGHT),
        icao24_from_flight_id(OTHER_FLIGHT),
    }
    assert len(sink.new_flights) == 3  # two for the first aircraft, one for the other
    assert sum(len(batch) for batch in sink.batches) == 4
    assert (report.points, report.aircraft, report.flights) == (4, 2, 3)
    assert (report.inserted, report.already_loaded) == (4, False)


async def test_each_observation_carries_the_keys_of_its_aircraft_and_flight(
    reader: Prc2024Reader, day: Path
) -> None:
    sink = FakeSink()

    await HistoricalImporter(reader).import_file(sink, day)

    batch = sink.batches[0]
    pairs = list(zip(batch.aircraft_ids, batch.flight_ids, strict=True))
    owner = {flight: aircraft for (aircraft, _), flight in sink.flights.items()}
    assert all(owner[flight] == aircraft for aircraft, flight in pairs)
    first = sink.aircraft[icao24_from_flight_id(FLIGHT)]
    assert len({flight for aircraft, flight in pairs if aircraft == first}) == 2


async def test_the_aircraft_and_flights_are_created_before_the_observations(
    reader: Prc2024Reader, day: Path
) -> None:
    sink = FakeSink()

    await HistoricalImporter(reader).import_file(sink, day)

    assert sink.calls[:3] == ["ensure_aircraft", "ensure_flights", "count_observations"]
    assert sink.calls[3] == "insert_observations"
    assert sink.calls[-1] == "count_observations"


async def test_the_observations_are_sent_in_batches(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()

    await HistoricalImporter(reader, batch_size=3).import_file(sink, day)

    assert [len(batch) for batch in sink.batches] == [3, 1]


async def test_a_file_already_in_the_database_is_not_read_again(
    reader: Prc2024Reader, day: Path
) -> None:
    sink = FakeSink()
    importer = HistoricalImporter(reader)
    await importer.import_file(sink, day)
    batches_before = len(sink.batches)

    report = await importer.import_file(sink, day)

    assert report.already_loaded is True
    assert report.inserted == 0
    assert len(sink.batches) == batches_before
    assert len(sink.new_flights) == 3  # no flight was created twice


async def test_a_partly_loaded_file_is_completed(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()
    importer = HistoricalImporter(reader)
    await importer.import_file(sink, day)
    sink.stored.pop()  # one observation is missing

    report = await importer.import_file(sink, day)

    assert (report.already_loaded, report.inserted) == (False, 1)
    assert len(sink.stored) == 4


async def test_more_observations_than_points_is_an_error(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()
    importer = HistoricalImporter(reader)
    await importer.import_file(sink, day)
    sink.stored.add((sink.aircraft[icao24_from_flight_id(FLIGHT)], 1))

    with pytest.raises(HistoricalImportError, match="something else wrote them"):
        await importer.import_file(sink, day)


async def test_observations_that_are_not_in_the_database_after_the_insert_are_an_error(
    reader: Prc2024Reader, day: Path
) -> None:
    with pytest.raises(HistoricalImportError, match="4 points read but 0 observations"):
        await HistoricalImporter(reader).import_file(LossySink(), day)


async def test_a_file_without_a_point_in_the_area_changes_nothing(
    reader: Prc2024Reader, tmp_path: Path
) -> None:
    sink = FakeSink()
    empty = write_day(tmp_path / f"{DAY}.parquet", [Point(latitude=10.0, longitude=100.0)])

    report = await HistoricalImporter(reader).import_file(sink, empty)

    assert (report.points, report.aircraft, report.flights) == (0, 0, 0)
    assert report.already_loaded is True
    assert sink.batches == []


async def test_a_flight_identifier_that_fits_no_icao24_code_stops_the_import(
    reader: Prc2024Reader, tmp_path: Path
) -> None:
    bad = write_day(tmp_path / f"{DAY}.parquet", [Point(flight_id=5)])

    with pytest.raises(ValueError, match="does not fit"):
        await HistoricalImporter(reader).import_file(FakeSink(), bad)


def test_the_batch_size_must_be_positive(reader: Prc2024Reader) -> None:
    with pytest.raises(ValueError, match="positive"):
        HistoricalImporter(reader, batch_size=0)


async def test_the_progress_follows_the_phases_and_the_batches(
    reader: Prc2024Reader, day: Path
) -> None:
    events: list[Progress] = []

    await HistoricalImporter(reader, batch_size=3, on_progress=events.append).import_file(
        FakeSink(), day
    )

    assert [(e.phase, e.done, e.total) for e in events] == [
        (Phase.READING, 0, 0),
        (Phase.PREPARING, 0, 4),
        (Phase.INSERTING, 0, 4),
        (Phase.INSERTING, 3, 4),
        (Phase.INSERTING, 4, 4),
        (Phase.VERIFYING, 4, 4),
    ]
    assert {e.path for e in events} == {day}


async def test_a_file_already_loaded_reports_no_insert(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()
    await HistoricalImporter(reader).import_file(sink, day)
    events: list[Progress] = []

    await HistoricalImporter(reader, on_progress=events.append).import_file(sink, day)

    assert [e.phase for e in events] == [Phase.READING, Phase.PREPARING]


async def test_without_a_listener_nothing_is_reported(reader: Prc2024Reader, day: Path) -> None:
    report = await HistoricalImporter(reader).import_file(FakeSink(), day)

    assert report.inserted == 4
