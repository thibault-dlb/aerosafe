from pathlib import Path

import pytest

from services.collection.profiles import BoundingBox
from services.historical.importer import (
    DEFAULT_WORKERS,
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
    FakeUnitOfWork,
    Point,
    SlowSink,
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


class FailingOnceSink(FakeSink):
    """A database that refuses the second batch it is given, the first time only."""

    def __init__(self) -> None:
        super().__init__()
        self.inserts = 0
        self.broken = True

    async def insert_observations(self, batch: ObservationBatch) -> int:
        self.inserts += 1
        if self.broken and self.inserts == 2:
            raise HistoricalImportError("the connection was lost")
        return await super().insert_observations(batch)


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


def importer(
    reader: Prc2024Reader, sink: FakeSink, **options
) -> tuple[HistoricalImporter, FakeUnitOfWork]:
    unit = FakeUnitOfWork(sink)
    return HistoricalImporter(reader, unit, **options), unit


async def test_a_file_becomes_aircraft_flights_and_observations(
    reader: Prc2024Reader, day: Path
) -> None:
    sink = FakeSink()
    loader, _ = importer(reader, sink)

    report = await loader.import_file(day)

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
    loader, _ = importer(reader, sink)

    await loader.import_file(day)

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
    loader, _ = importer(reader, sink)

    await loader.import_file(day)

    assert sink.calls[:3] == ["ensure_aircraft", "ensure_flights", "count_observations"]
    assert sink.calls[3] == "insert_observations"
    assert sink.calls[-1] == "count_observations"


async def test_the_observations_are_sent_in_batches(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()
    loader, _ = importer(reader, sink, batch_size=3)

    await loader.import_file(day)

    assert sorted(len(batch) for batch in sink.batches) == [1, 3]


async def test_the_preparation_each_batch_and_the_check_are_committed_separately(
    reader: Prc2024Reader, day: Path
) -> None:
    loader, unit = importer(reader, FakeSink(), batch_size=3)

    await loader.import_file(day)

    # The aircraft and flights, two batches, then the final count.
    assert unit.log == ["begin", "commit"] * 4


async def test_a_file_already_in_the_database_is_not_read_again(
    reader: Prc2024Reader, day: Path
) -> None:
    sink = FakeSink()
    loader, _ = importer(reader, sink)
    await loader.import_file(day)
    batches_before = len(sink.batches)

    report = await loader.import_file(day)

    assert report.already_loaded is True
    assert report.inserted == 0
    assert len(sink.batches) == batches_before
    assert len(sink.new_flights) == 3  # no flight was created twice


async def test_a_partly_loaded_file_is_completed(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()
    loader, _ = importer(reader, sink)
    await loader.import_file(day)
    sink.stored.pop()  # one observation is missing

    report = await loader.import_file(day)

    assert (report.already_loaded, report.inserted) == (False, 1)
    assert len(sink.stored) == 4


async def test_more_observations_than_points_is_an_error(reader: Prc2024Reader, day: Path) -> None:
    sink = FakeSink()
    loader, _ = importer(reader, sink)
    await loader.import_file(day)
    sink.stored.add((sink.aircraft[icao24_from_flight_id(FLIGHT)], 1))

    with pytest.raises(HistoricalImportError, match="something else wrote them"):
        await loader.import_file(day)


async def test_observations_that_are_not_in_the_database_after_the_insert_are_an_error(
    reader: Prc2024Reader, day: Path
) -> None:
    loader, _ = importer(reader, LossySink())

    with pytest.raises(HistoricalImportError, match="4 points read but 0 observations"):
        await loader.import_file(day)


async def test_a_file_without_a_point_in_the_area_changes_nothing(
    reader: Prc2024Reader, tmp_path: Path
) -> None:
    sink = FakeSink()
    empty = write_day(tmp_path / f"{DAY}.parquet", [Point(latitude=10.0, longitude=100.0)])
    loader, _ = importer(reader, sink)

    report = await loader.import_file(empty)

    assert (report.points, report.aircraft, report.flights) == (0, 0, 0)
    assert report.already_loaded is True
    assert sink.batches == []


async def test_a_flight_identifier_that_fits_no_icao24_code_stops_the_import(
    reader: Prc2024Reader, tmp_path: Path
) -> None:
    bad = write_day(tmp_path / f"{DAY}.parquet", [Point(flight_id=5)])
    loader, _ = importer(reader, FakeSink())

    with pytest.raises(ValueError, match="does not fit"):
        await loader.import_file(bad)


def test_the_batch_size_must_be_positive(reader: Prc2024Reader) -> None:
    with pytest.raises(ValueError, match="positive"):
        HistoricalImporter(reader, FakeUnitOfWork(FakeSink()), batch_size=0)


class TestWorkers:
    @pytest.fixture
    def points(self, tmp_path: Path) -> Path:
        return write_day(
            tmp_path / f"{DAY}.parquet", [Point(at=at(0, second)) for second in range(12)]
        )

    def test_the_default_is_six_workers(self) -> None:
        assert DEFAULT_WORKERS == 6

    @pytest.mark.parametrize("workers", [0, -1])
    def test_at_least_one_worker_is_needed(self, reader: Prc2024Reader, workers: int) -> None:
        with pytest.raises(ValueError, match="at least one worker"):
            HistoricalImporter(reader, FakeUnitOfWork(FakeSink()), workers=workers)

    @pytest.mark.parametrize("workers", [1, 3, 6, 16, 64])
    def test_the_number_of_workers_has_no_upper_limit(
        self, reader: Prc2024Reader, workers: int
    ) -> None:
        HistoricalImporter(reader, FakeUnitOfWork(FakeSink()), workers=workers)

    async def test_several_workers_insert_at_the_same_time_but_never_more_than_asked(
        self, reader: Prc2024Reader, points: Path
    ) -> None:
        sink = SlowSink()
        loader, unit = importer(reader, sink, batch_size=1, workers=3)

        report = await loader.import_file(points)

        assert report.inserted == 12
        assert len(sink.stored) == 12
        assert 2 <= unit.max_active <= 3

    async def test_one_worker_inserts_one_batch_at_a_time(
        self, reader: Prc2024Reader, points: Path
    ) -> None:
        loader, unit = importer(reader, SlowSink(), batch_size=1, workers=1)

        await loader.import_file(points)

        assert unit.max_active == 1

    async def test_every_row_is_stored_once_whatever_the_number_of_workers(
        self, reader: Prc2024Reader, points: Path
    ) -> None:
        sink = SlowSink()
        loader, _ = importer(reader, sink, batch_size=2, workers=DEFAULT_WORKERS)

        await loader.import_file(points)

        seen = [
            key
            for batch in sink.batches
            for key in zip(batch.aircraft_ids, batch.observed_us, strict=True)
        ]
        assert len(seen) == len(set(seen)) == 12

    async def test_a_failing_batch_stops_the_import_with_its_own_error(
        self, reader: Prc2024Reader, points: Path
    ) -> None:
        loader, unit = importer(reader, FailingOnceSink(), batch_size=1, workers=3)

        with pytest.raises(HistoricalImportError, match="connection was lost"):
            await loader.import_file(points)

        assert "rollback" in unit.log

    async def test_a_file_stopped_halfway_is_completed_by_running_it_again(
        self, reader: Prc2024Reader, points: Path
    ) -> None:
        sink = FailingOnceSink()
        loader, _ = importer(reader, sink, batch_size=1, workers=3)
        with pytest.raises(HistoricalImportError):
            await loader.import_file(points)
        stored_before = len(sink.stored)
        sink.broken = False

        report = await loader.import_file(points)

        assert 0 < stored_before < 12
        assert len(sink.stored) == 12
        assert report.already_loaded is False
        assert report.inserted == 12 - stored_before


async def test_the_progress_follows_the_phases_and_the_batches(
    reader: Prc2024Reader, day: Path
) -> None:
    events: list[Progress] = []
    loader = HistoricalImporter(
        reader, FakeUnitOfWork(FakeSink()), batch_size=3, on_progress=events.append
    )

    await loader.import_file(day)

    assert [(e.phase, e.done, e.total) for e in events] == [
        (Phase.READING, 0, 0),
        (Phase.PREPARING, 0, 4),
        (Phase.INSERTING, 0, 4),
        (Phase.INSERTING, 3, 4),
        (Phase.INSERTING, 4, 4),
        (Phase.VERIFYING, 4, 4),
    ]
    assert {e.path for e in events} == {day}


async def test_the_progress_counts_the_points_stored_by_all_the_workers(
    reader: Prc2024Reader, day: Path
) -> None:
    events: list[Progress] = []
    loader = HistoricalImporter(
        reader,
        FakeUnitOfWork(SlowSink()),
        batch_size=1,
        workers=2,
        on_progress=events.append,
    )

    await loader.import_file(day)

    inserting = [e.done for e in events if e.phase is Phase.INSERTING]
    assert inserting == [0, 1, 2, 3, 4]


async def test_a_file_already_loaded_reports_no_insert(reader: Prc2024Reader, day: Path) -> None:
    unit = FakeUnitOfWork(FakeSink())
    await HistoricalImporter(reader, unit).import_file(day)
    events: list[Progress] = []

    await HistoricalImporter(reader, unit, on_progress=events.append).import_file(day)

    assert [e.phase for e in events] == [Phase.READING, Phase.PREPARING]


async def test_without_a_listener_nothing_is_reported(reader: Prc2024Reader, day: Path) -> None:
    loader, _ = importer(reader, FakeSink())

    report = await loader.import_file(day)

    assert report.inserted == 4
