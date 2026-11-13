"""The replay against a real PostgreSQL with the migrations applied.

The replayed points are dated in 2023, outside the dataset, so they never meet the real
imported data of the development database. Uses the session fixture of
tests/integration/conftest.py, rolled back after each test.
"""

import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from models import Aircraft, Alert, Flight, Rule
from models.reference import DataSource
from services.aircraft import AircraftSearchCriteria, AircraftService
from services.historical.prc2024 import ObservationBatch
from services.historical.store import HistoricalStore, NewFlight, to_microseconds
from services.replay import DatabaseReplayStore, ReplayService, ReplayState
from services.rules.engine import RulesEngine
from services.rules.observations import SnapshotReader

pytestmark = pytest.mark.integration

T0 = datetime(2023, 3, 1, 12, tzinfo=UTC)
SECOND = 1_000_000


def icao24() -> str:
    return secrets.token_hex(3)


async def replayed(
    session: AsyncSession, code: str, altitudes: dict[int, float]
) -> tuple[int, int]:
    """A replayed aircraft with one flight and a point at each given second from T0."""
    store = HistoricalStore(session)
    aircraft = (await store.ensure_aircraft([code]))[code]
    start = to_microseconds(T0)
    last = max(altitudes)
    flights = await store.ensure_flights([NewFlight(aircraft, start, start + last * SECOND)])
    flight = flights[(aircraft, start)]
    seconds = sorted(altitudes)
    size = len(seconds)
    await store.insert_observations(
        ObservationBatch(
            aircraft_ids=[aircraft] * size,
            flight_ids=[flight] * size,
            observed_us=[start + second * SECOND for second in seconds],
            longitudes=[2.5] * size,
            latitudes=[48.8] * size,
            altitudes=[altitudes[second] for second in seconds],
            speeds=[230.0] * size,
            headings=[90.0] * size,
            on_grounds=[False] * size,
        )
    )
    return aircraft, flight


def factory(session: AsyncSession):
    @asynccontextmanager
    async def make() -> AsyncIterator[AsyncSession]:
        yield session

    return make


async def rule(session: AsyncSession, code: str) -> Rule:
    return (await session.scalars(select(Rule).where(Rule.code == code))).one()


class TestSourceOfTheAircraft:
    async def test_a_new_aircraft_is_live_by_default(self, session: AsyncSession) -> None:
        aircraft = Aircraft(icao24=icao24())
        session.add(aircraft)
        await session.flush()

        source = await session.scalar(
            select(DataSource.code).where(DataSource.id == aircraft.source_id)
        )

        assert source == "DIRECT"

    async def test_a_live_and_a_replayed_aircraft_can_share_an_address(
        self, session: AsyncSession
    ) -> None:
        code = icao24()
        live = Aircraft(icao24=code)
        session.add(live)
        await session.flush()

        replay = (await HistoricalStore(session).ensure_aircraft([code]))[code]

        assert replay != live.id

    async def test_two_aircraft_of_the_same_source_cannot_share_an_address(
        self, session: AsyncSession
    ) -> None:
        code = icao24()
        session.add(Aircraft(icao24=code))
        await session.flush()

        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                session.add(Aircraft(icao24=code))
                await session.flush()

    async def test_the_collector_still_finds_its_own_aircraft_by_address(
        self, session: AsyncSession
    ) -> None:
        from services.collection.flight_grouper import FlightGrouper
        from services.collection.store import ObservationStore

        code = icao24()
        await HistoricalStore(session).ensure_aircraft([code])
        store = ObservationStore(session, FlightGrouper(timedelta(minutes=30)))

        ids = await store._ensure_aircraft({code})

        live = await session.get(Aircraft, ids[code])
        replayed_id = (await HistoricalStore(session).ensure_aircraft([code]))[code]
        assert live is not None and live.id != replayed_id


class TestSnapshots:
    async def test_the_replay_reads_the_traffic_at_the_instant_and_never_after_it(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {s: 1000.0 for s in range(0, 31)})

        snapshots = await SnapshotReader(session).read(T0 + timedelta(seconds=25), DataMode.REPLAY)

        [mine] = [s for s in snapshots if s.aircraft_id == aircraft]
        assert mine.latest.last_contact_at == T0 + timedelta(seconds=25)
        # The nearest point at least 10 s back, the rates ignore closer ones.
        assert mine.previous is not None
        assert mine.previous.last_contact_at == T0 + timedelta(seconds=15)

    async def test_an_aircraft_silent_for_a_minute_is_not_present(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {0: 1000.0, 5: 1000.0})

        snapshots = await SnapshotReader(session).read(T0 + timedelta(seconds=90), DataMode.REPLAY)

        assert aircraft not in {s.aircraft_id for s in snapshots}

    async def test_the_live_reading_does_not_see_the_replayed_aircraft(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {s: 1000.0 for s in range(0, 31)})

        snapshots = await SnapshotReader(session).read(T0 + timedelta(seconds=25), DataMode.LIVE)

        assert aircraft not in {s.aircraft_id for s in snapshots}


class TestRulesInAReplay:
    async def test_a_steep_climb_raises_r3_at_the_simulated_time(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {0: 1000.0, 10: 1400.0})
        now = T0 + timedelta(seconds=10)

        await RulesEngine(session).evaluate(now, DataMode.REPLAY)

        alerts = list(await session.scalars(select(Alert).where(Alert.aircraft_id == aircraft)))
        [alert] = alerts
        assert alert.triggered_at == now
        assert alert.observed_value == Decimal("40.000")

    async def test_a_live_evaluation_raises_nothing_for_a_replayed_aircraft(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {0: 1000.0, 10: 1400.0})

        await RulesEngine(session).evaluate(T0 + timedelta(seconds=10), DataMode.LIVE)

        assert (
            await session.scalars(select(Alert).where(Alert.aircraft_id == aircraft))
        ).all() == []

    async def test_a_replay_evaluation_never_ends_a_live_episode(
        self, session: AsyncSession
    ) -> None:
        live = Aircraft(icao24=icao24())
        session.add(live)
        await session.flush()
        r3 = await rule(session, "R3")
        episode = Alert(
            aircraft_id=live.id,
            rule_id=r3.id,
            message="live",
            triggered_at=T0 - timedelta(hours=1),
            observed_value=Decimal("40"),
            threshold=Decimal("30"),
        )
        session.add(episode)
        await session.flush()

        await RulesEngine(session).evaluate(T0 + timedelta(seconds=10), DataMode.REPLAY)
        await session.refresh(episode)

        assert episode.episode_ended_at is None

    async def test_the_delay_rules_are_not_evaluated_in_a_replay(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {0: 1000.0, 10: 1000.0})

        report = await RulesEngine(session).evaluate(T0 + timedelta(seconds=10), DataMode.REPLAY)

        codes = {
            (await session.get(Rule, a.rule_id)).code for a in await alerts_of(session, aircraft)
        }
        assert codes <= {"R3", "R4", "R5"}
        assert report.rules == 3


async def alerts_of(session: AsyncSession, aircraft: int) -> list[Alert]:
    return list(await session.scalars(select(Alert).where(Alert.aircraft_id == aircraft)))


class TestAircraftAtTheInstant:
    async def test_the_search_lists_the_aircraft_present_with_their_position_then(
        self, session: AsyncSession
    ) -> None:
        code = icao24()
        await replayed(session, code, {s: 1000.0 for s in range(0, 31)})
        at = T0 + timedelta(seconds=25)

        [summary] = await AircraftService(session).search(
            AircraftSearchCriteria(icao24=code, mode=DataMode.REPLAY, at=at)
        )

        assert summary.last_contact_at == at
        assert (summary.latitude, summary.longitude) == (48.8, 2.5)

    async def test_an_aircraft_that_is_gone_is_not_listed(self, session: AsyncSession) -> None:
        code = icao24()
        await replayed(session, code, {s: 1000.0 for s in range(0, 31)})

        found = await AircraftService(session).search(
            AircraftSearchCriteria(icao24=code, mode=DataMode.REPLAY, at=T0 + timedelta(hours=2))
        )

        assert found == []

    async def test_the_live_search_does_not_list_a_replayed_aircraft(
        self, session: AsyncSession
    ) -> None:
        code = icao24()
        await replayed(session, code, {0: 1000.0})

        assert await AircraftService(session).search(AircraftSearchCriteria(icao24=code)) == []

    async def test_a_live_aircraft_keeps_its_latest_position_through_the_index(
        self, session: AsyncSession
    ) -> None:
        from services.collection.flight_grouper import FlightGrouper
        from services.collection.normalizer import NormalizedState
        from services.collection.store import ObservationStore

        code = icao24()
        now = datetime(2026, 11, 9, 10, tzinfo=UTC)
        store = ObservationStore(session, FlightGrouper(timedelta(minutes=30)))
        for seconds_ago, latitude in [(60, 48.0), (30, 49.0)]:
            at = now - timedelta(seconds=seconds_ago)
            await store.save(
                [
                    NormalizedState(
                        icao24=code,
                        callsign=None,
                        last_contact_at=at,
                        position_at=at,
                        latitude=latitude,
                        longitude=2.5,
                        altitude=Decimal("1000.0"),
                        speed=Decimal("200.00"),
                        heading=Decimal("90.00"),
                        on_ground=False,
                    )
                ]
            )

        [summary] = await AircraftService(session).search(AircraftSearchCriteria(icao24=code))

        assert summary.latitude == 49.0

    async def test_the_record_reads_the_position_up_to_the_instant(
        self, session: AsyncSession
    ) -> None:
        code = icao24()
        aircraft, _ = await replayed(session, code, {s: 1000.0 for s in range(0, 31)})
        public_id = (await session.get(Aircraft, aircraft)).public_id

        summary = await AircraftService(session).get(public_id, T0 + timedelta(seconds=12))

        assert summary is not None
        assert summary.last_contact_at == T0 + timedelta(seconds=12)


class TestStore:
    async def test_the_clock_is_kept_in_its_single_row(self, session: AsyncSession) -> None:
        store = DatabaseReplayStore(factory(session))
        assert not (await store.state()).started

        saved = ReplayState(T0, T0 + timedelta(hours=1), 60, False, T0 - timedelta(seconds=30))
        await store.save(saved)

        assert await store.state() == saved

    async def test_the_period_is_the_one_of_the_replayed_flights(
        self, session: AsyncSession
    ) -> None:
        await replayed(session, icao24(), {0: 1000.0, 90: 1000.0})

        bounds = await DatabaseReplayStore(factory(session)).bounds()

        assert bounds is not None
        assert bounds.start <= T0 and bounds.end >= T0 + timedelta(seconds=90)

    async def test_a_restart_removes_the_later_alerts_and_ends_the_open_episodes(
        self, session: AsyncSession
    ) -> None:
        aircraft, _ = await replayed(session, icao24(), {0: 1000.0, 10: 1000.0})
        r3, r4 = await rule(session, "R3"), await rule(session, "R4")
        restart = T0 + timedelta(seconds=60)

        def alert(seconds: int, raised: Rule) -> Alert:
            # One open episode per aircraft and rule, so the two alerts use two rules.
            return Alert(
                aircraft_id=aircraft,
                rule_id=raised.id,
                message=raised.code,
                triggered_at=T0 + timedelta(seconds=seconds),
                observed_value=Decimal("40"),
                threshold=Decimal("30"),
            )

        before, after = alert(10, r3), alert(120, r4)
        session.add_all([before, after])
        await session.flush()

        await DatabaseReplayStore(factory(session)).restart(
            ReplayState(restart, T0, 10, False, restart - timedelta(seconds=30))
        )
        await session.refresh(before)
        await session.refresh(after)

        assert before.episode_ended_at == restart and before.deleted_at is None
        assert after.deleted_at is not None
        assert after.episode_ended_at == after.triggered_at

    async def test_a_restart_leaves_the_alerts_of_live_aircraft_alone(
        self, session: AsyncSession
    ) -> None:
        live = Aircraft(icao24=icao24())
        session.add(live)
        await session.flush()
        r3 = await rule(session, "R3")
        episode = Alert(
            aircraft_id=live.id,
            rule_id=r3.id,
            message="live",
            triggered_at=T0 + timedelta(seconds=120),
            observed_value=Decimal("40"),
            threshold=Decimal("30"),
        )
        session.add(episode)
        await session.flush()

        await DatabaseReplayStore(factory(session)).restart(
            ReplayState(T0, T0, 10, False, T0 - timedelta(seconds=30))
        )
        await session.refresh(episode)

        assert episode.deleted_at is None and episode.episode_ended_at is None

    async def test_the_service_starts_and_reads_the_clock_on_the_real_tables(
        self, session: AsyncSession
    ) -> None:
        await replayed(session, icao24(), {0: 1000.0, 90: 1000.0})
        service = ReplayService(DatabaseReplayStore(factory(session)))

        status = await service.start(T0 + timedelta(seconds=5), 10, None)

        assert status.available and not status.paused
        assert status.simulated_at is not None and status.simulated_at >= T0 + timedelta(seconds=5)
        assert status.speed == 10

    async def test_a_flight_of_the_replay_is_a_flight_of_a_replayed_aircraft(
        self, session: AsyncSession
    ) -> None:
        aircraft, flight = await replayed(session, icao24(), {0: 1000.0})

        stored = await session.get(Flight, flight)

        assert stored is not None and stored.aircraft_id == aircraft
