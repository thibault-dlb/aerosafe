"""The rules on replayed traffic: its own source, a closed window and a previous point 10 s back."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from core.data_mode import DataMode
from models import Alert, Rule
from services.rules.base import AircraftSnapshot, StateSample
from services.rules.delay import LastContactRule, StalePositionRule
from services.rules.engine import RulesEngine
from services.rules.observations import REPLAY_SILENCE_LIMIT, SILENCE_LIMIT, SnapshotReader
from services.rules.rates import AltitudeRateRule, HeadingRateRule, SpeedRateRule

NOW = datetime(2022, 8, 14, 15, 0, tzinfo=UTC)


def compiled(statement):
    return statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": False})


def literal_sql(statement) -> str:
    return str(
        statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )


def row(aircraft_id: int, seconds_ago: int, flight_id: int | None, rank: int, **values):
    at = NOW - timedelta(seconds=seconds_ago)
    columns = {
        "aircraft_id": aircraft_id,
        "icao24": f"{aircraft_id:06x}",
        "flight_id": flight_id,
        "last_contact_at": at,
        "position_at": at,
        "altitude": Decimal("10000.0"),
        "speed": Decimal("230.00"),
        "heading": Decimal("90.00"),
        "on_ground": False,
        "aircraft_rank": rank,
        "flight_rank": rank,
    }
    columns.update(values)
    return SimpleNamespace(**columns)


def result(rows: list) -> MagicMock:
    value = MagicMock()
    value.all.return_value = rows
    return value


class TestRecentQuery:
    def test_a_replay_closes_the_window_at_the_instant_of_the_clock(self) -> None:
        query = compiled(SnapshotReader(AsyncMock()).recent_query(NOW, DataMode.REPLAY))

        assert '"DT_DERNIER_CONTACT" <=' in str(query)
        assert NOW in query.params.values()
        assert NOW - REPLAY_SILENCE_LIMIT in query.params.values()
        assert NOW - SILENCE_LIMIT not in query.params.values()

    def test_the_live_window_keeps_its_length_and_has_no_upper_bound(self) -> None:
        query = compiled(SnapshotReader(AsyncMock()).recent_query(NOW))

        assert '"DT_DERNIER_CONTACT" <=' not in str(query)
        assert NOW - SILENCE_LIMIT in query.params.values()

    def test_a_replay_keeps_every_row_of_the_window_for_the_previous_point(self) -> None:
        live = str(compiled(SnapshotReader(AsyncMock()).recent_query(NOW)))
        replay = str(compiled(SnapshotReader(AsyncMock()).recent_query(NOW, DataMode.REPLAY)))

        assert "aircraft_rank = " in live
        assert "aircraft_rank = " not in replay

    @pytest.mark.parametrize(
        ("mode", "code"), [(DataMode.LIVE, "DIRECT"), (DataMode.REPLAY, "REJEU")]
    )
    def test_each_mode_reads_the_aircraft_of_its_own_source(
        self, mode: DataMode, code: str
    ) -> None:
        sql = literal_sql(SnapshotReader(AsyncMock()).recent_query(NOW, mode))

        assert '"R_SOURCE_DONNEE"."CD_SOURCE_DONNEE" = \'' + code + "'" in sql

    def test_the_window_lengths_are_set_apart(self) -> None:
        reader = SnapshotReader(AsyncMock(), timedelta(minutes=5), timedelta(seconds=20))

        replay = compiled(reader.recent_query(NOW, DataMode.REPLAY))
        live = compiled(reader.recent_query(NOW))

        assert NOW - timedelta(seconds=20) in replay.params.values()
        assert NOW - timedelta(minutes=5) in live.params.values()


class TestReadInAReplay:
    async def test_the_previous_point_is_the_nearest_one_at_least_ten_seconds_back(self) -> None:
        session = AsyncMock()
        rows = [
            row(1, 0, flight_id=5, rank=1),
            row(1, 1, flight_id=5, rank=2),
            row(1, 9, flight_id=5, rank=3),
            row(1, 10, flight_id=5, rank=4),
            row(1, 11, flight_id=5, rank=5),
        ]
        session.execute.return_value = result(rows)

        [snapshot] = await SnapshotReader(session).read(NOW, DataMode.REPLAY)

        assert snapshot.previous is not None
        assert snapshot.previous.last_contact_at == NOW - timedelta(seconds=10)

    async def test_a_point_of_another_flight_is_never_the_previous_one(self) -> None:
        session = AsyncMock()
        session.execute.return_value = result(
            [row(1, 0, flight_id=5, rank=1), row(1, 20, flight_id=4, rank=2)]
        )

        [snapshot] = await SnapshotReader(session).read(NOW, DataMode.REPLAY)

        assert snapshot.previous is None

    async def test_an_aircraft_seen_for_less_than_ten_seconds_has_no_previous_point(self) -> None:
        session = AsyncMock()
        session.execute.return_value = result(
            [row(1, 0, flight_id=5, rank=1), row(1, 5, flight_id=5, rank=2)]
        )

        [snapshot] = await SnapshotReader(session).read(NOW, DataMode.REPLAY)

        assert snapshot.previous is None

    async def test_a_point_outside_any_flight_has_no_previous_point(self) -> None:
        session = AsyncMock()
        session.execute.return_value = result(
            [row(1, 0, flight_id=None, rank=1), row(1, 20, flight_id=None, rank=2)]
        )

        [snapshot] = await SnapshotReader(session).read(NOW, DataMode.REPLAY)

        assert snapshot.previous is None

    async def test_the_latest_position_is_not_looked_up_since_r2_is_not_evaluated(self) -> None:
        session = AsyncMock()
        session.execute.return_value = result([row(1, 0, flight_id=5, rank=1)])

        [snapshot] = await SnapshotReader(session).read(NOW, DataMode.REPLAY)

        session.execute.assert_awaited_once()
        assert snapshot.latest_with_position is None

    async def test_live_still_takes_the_observation_just_before(self) -> None:
        session = AsyncMock()
        recent = [row(1, 0, flight_id=5, rank=1), row(1, 3, flight_id=5, rank=2)]
        session.execute.side_effect = [result(recent), result([row(1, 0, flight_id=5, rank=1)])]

        [snapshot] = await SnapshotReader(session).read(NOW)

        assert snapshot.previous is not None
        assert snapshot.previous.last_contact_at == NOW - timedelta(seconds=3)
        assert snapshot.latest_with_position is not None


class TestRuleFlags:
    @pytest.mark.parametrize("rule", [LastContactRule(), StalePositionRule()])
    def test_the_delay_rules_mean_nothing_on_replayed_traffic(self, rule) -> None:
        assert rule.evaluated_in_replay is False

    @pytest.mark.parametrize("rule", [AltitudeRateRule(), SpeedRateRule(), HeadingRateRule()])
    def test_the_rate_rules_are_evaluated_in_a_replay(self, rule) -> None:
        assert rule.evaluated_in_replay is True


def model(code: str, threshold: str, rule_id: int) -> Rule:
    return Rule(
        id=rule_id,
        code=code,
        description=code,
        threshold=Decimal(threshold),
        unit_id=1,
        criticality_id=2,
        is_active=True,
    )


def scalars(items: list) -> MagicMock:
    value = MagicMock()
    value.all.return_value = items
    return value


def engine_with(rules: list[Rule], snapshots: list[AircraftSnapshot]):
    session = MagicMock()
    session.scalars = AsyncMock(side_effect=[scalars(rules), scalars([])])
    session.flush = AsyncMock()
    reader = MagicMock()
    reader.read = AsyncMock(return_value=snapshots)
    return RulesEngine(session, reader=reader), session, reader


def fast_climb() -> AircraftSnapshot:
    previous = StateSample(
        NOW - timedelta(seconds=10), NOW - timedelta(seconds=10), 1000.0, 230.0, 90.0, False, 5
    )
    latest = StateSample(NOW, NOW, 1400.0, 230.0, 90.0, False, 5)
    return AircraftSnapshot(1, "000001", latest, previous, None)


class TestEngineInAReplay:
    async def test_the_delay_rules_are_left_out_and_the_reader_is_given_the_mode(self) -> None:
        rules = [model("R1", "300", 1), model("R2", "600", 2), model("R3", "30", 3)]
        engine, _, reader = engine_with(rules, [])

        report = await engine.evaluate(NOW, DataMode.REPLAY)

        reader.read.assert_awaited_once_with(NOW, DataMode.REPLAY)
        assert report.rules == 1

    async def test_live_keeps_every_rule(self) -> None:
        rules = [model("R1", "300", 1), model("R3", "30", 3)]
        engine, _, reader = engine_with(rules, [])

        report = await engine.evaluate(NOW)

        reader.read.assert_awaited_once_with(NOW, DataMode.LIVE)
        assert report.rules == 2

    async def test_a_climb_of_40_m_s_triggers_r3_at_the_simulated_time(self) -> None:
        engine, session, _ = engine_with([model("R3", "30", 3)], [fast_climb()])
        session.scalars = AsyncMock(side_effect=[scalars([model("R3", "30", 3)]), scalars([])])

        await engine.evaluate(NOW, DataMode.REPLAY)

        [alert] = [call.args[0] for call in session.add.call_args_list]
        assert isinstance(alert, Alert)
        assert alert.triggered_at == NOW
        assert alert.observed_value == Decimal("40.0")

    async def test_the_open_episodes_are_those_of_the_aircraft_of_the_source(self) -> None:
        session = MagicMock()

        live = literal_sql(RulesEngine.open_episodes_query(session, DataMode.LIVE))
        replay = literal_sql(RulesEngine.open_episodes_query(session, DataMode.REPLAY))

        assert "'DIRECT'" in live and "'REJEU'" not in live
        assert "'REJEU'" in replay and "'DIRECT'" not in replay
        assert '"ALERTE"."DT_FIN_EPISODE" IS NULL' in replay
        assert 'JOIN "AERONEF"' in replay
