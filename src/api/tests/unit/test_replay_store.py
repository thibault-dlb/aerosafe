from types import SimpleNamespace

from sqlalchemy.dialects import postgresql

from models import ReplayParameter
from services.replay.clock import ReplayBounds, ReplayState
from services.replay.store import DatabaseReplayStore, get_replay_store
from tests.replay_support import END, REAL, START, T0, FakeSession, session_factory


def sql(statement: object) -> str:
    return str(
        statement.compile(  # type: ignore[attr-defined]
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )


def parameter(**values) -> ReplayParameter:
    return ReplayParameter(
        simulated_at=values.get("simulated_at"),
        changed_at=values.get("changed_at"),
        speed=values.get("speed", 1),
        is_paused=values.get("is_paused", True),
        evaluated_until=values.get("evaluated_until"),
        changed_by_id=values.get("changed_by_id"),
    )


class TestState:
    async def test_the_row_is_read_as_a_state(self) -> None:
        session = FakeSession(
            parameter(
                simulated_at=T0,
                changed_at=REAL,
                speed=10,
                is_paused=False,
                evaluated_until=T0,
                changed_by_id=4,
            )
        )

        state = await DatabaseReplayStore(session_factory(session)).state()

        assert state == ReplayState(T0, REAL, 10, False, T0, 4)

    async def test_a_state_is_written_into_the_single_row_and_committed(self) -> None:
        row = parameter()
        session = FakeSession(row)

        await DatabaseReplayStore(session_factory(session)).save(
            ReplayState(T0, REAL, 60, False, T0, 9)
        )

        assert (row.simulated_at, row.changed_at, row.speed) == (T0, REAL, 60)
        assert (row.is_paused, row.evaluated_until, row.changed_by_id) == (False, T0, 9)
        assert session.commits == 1

    async def test_the_evaluation_is_noted_in_the_callers_transaction(self) -> None:
        row = parameter()

        await DatabaseReplayStore.record_evaluation(FakeSession(row), T0)  # type: ignore[arg-type]

        assert row.evaluated_until == T0

    def test_the_default_store_is_given_to_the_routes(self) -> None:
        assert isinstance(get_replay_store(), DatabaseReplayStore)


class TestBounds:
    async def test_the_period_is_the_one_of_the_replayed_flights(self) -> None:
        session = FakeSession(rows=[(START, END)])

        bounds = await DatabaseReplayStore(session_factory(session)).bounds()

        assert bounds == ReplayBounds(START, END)
        query = sql(session.executed[0])
        assert '"VOL"' in query and "'REJEU'" in query
        assert "OBSERVATION" not in query

    async def test_no_replayed_flight_means_no_period(self) -> None:
        session = FakeSession(rows=[(None, None)])

        assert await DatabaseReplayStore(session_factory(session)).bounds() is None


class TestResetAlerts:
    async def test_the_later_alerts_are_removed_and_the_open_episodes_end_at_the_restart(
        self,
    ) -> None:
        session = FakeSession()

        await DatabaseReplayStore(session_factory(session)).reset_alerts(T0)

        removed, ended = (sql(statement) for statement in session.executed)
        assert removed.startswith('UPDATE "ALERTE" SET')
        assert "deleted_at=now()" in removed
        assert '"DT_DECLENCHEMENT" >=' in removed
        assert "'REJEU'" in removed and "'REJEU'" in ended
        assert 'SET "DT_FIN_EPISODE"=' in ended
        assert '"DT_FIN_EPISODE" IS NULL' in ended
        assert session.commits == 1

    async def test_a_removed_alert_gets_an_end_that_is_not_before_its_trigger(self) -> None:
        session = FakeSession()

        await DatabaseReplayStore(session_factory(session)).reset_alerts(T0)

        assert 'coalesce("ALERTE"."DT_FIN_EPISODE", "ALERTE"."DT_DECLENCHEMENT")' in sql(
            session.executed[0]
        )


def test_the_session_double_answers_a_one_row_result() -> None:
    assert FakeSession(rows=[(1, 2)]).rows == [(1, 2)]
    assert SimpleNamespace(a=1).a == 1
