from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import NoResultFound

from models import CollectionParameter, CollectionProfile, CollectionRun, CollectionStatus
from services.collection import run_repository
from services.collection.run_repository import DatabaseCollectionStateStore, get_state_store
from services.collection.run_state import CollectionRunResult, PauseState, RunStatus

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)


class IterableScalars(SimpleNamespace):
    def __iter__(self):
        return iter(self.items)


class FakeSession:
    """Answers the queries of the repository and records what it adds and commits."""

    def __init__(
        self,
        reference_ids: list[int] | None = None,
        runs: list[CollectionRun] | None = None,
        parameter: CollectionParameter | None = None,
    ) -> None:
        self.reference_ids = list(reference_ids or [])
        self.runs = runs or []
        self.parameter = parameter
        self.added: list[CollectionRun] = []
        self.statements: list = []
        self.commits = 0

    def add(self, run: CollectionRun) -> None:
        self.added.append(run)

    async def commit(self) -> None:
        self.commits += 1

    async def execute(self, statement) -> SimpleNamespace:
        self.statements.append(statement)

        def scalar_one() -> int:
            if not self.reference_ids:
                raise NoResultFound
            return self.reference_ids.pop(0)

        return SimpleNamespace(scalar_one=scalar_one)

    async def scalars(self, statement) -> SimpleNamespace:
        self.statements.append(statement)
        items = [self.parameter] if self.parameter else self.runs
        return IterableScalars(one=lambda: items[0], items=items)

    async def scalar(self, statement) -> CollectionRun | None:
        self.statements.append(statement)
        return self.runs[0] if self.runs else None

    def sql(self, index: int = 0) -> str:
        return str(self.statements[index].compile(dialect=postgresql.dialect()))


def repository_on(session: FakeSession) -> DatabaseCollectionStateStore:
    @asynccontextmanager
    async def factory():
        yield session

    return DatabaseCollectionStateStore(factory)


def stored_run(
    seconds: int = 0, status: str = "SUCCESS", ended: bool = True, error: str | None = None
) -> CollectionRun:
    started = T0 + timedelta(seconds=seconds)
    return CollectionRun(
        started_at=started,
        ended_at=started + timedelta(seconds=5) if ended else None,
        status=CollectionStatus(code=status),
        profile=CollectionProfile(code="ILE_DE_FRANCE"),
        states_received=10,
        states_stored=8,
        states_rejected=2,
        remaining_credits=3990,
        error=error,
        evaluation_error=None,
    )


def result_of(status: str = RunStatus.SUCCESS) -> CollectionRunResult:
    return CollectionRunResult(
        started_at=T0,
        ended_at=T0 + timedelta(seconds=5),
        status=status,
        profile="ILE_DE_FRANCE",
        received=10,
        stored=8,
        rejected=2,
        remaining_credits=3990,
        error=None,
        evaluation_error="engine failed",
    )


async def test_a_run_is_inserted_complete_with_the_keys_of_its_references() -> None:
    session = FakeSession(reference_ids=[11, 22])

    await repository_on(session).record(result_of())

    [run] = session.added
    assert (run.status_id, run.profile_id) == (11, 22)
    assert (run.states_received, run.states_stored, run.states_rejected) == (10, 8, 2)
    assert run.remaining_credits == 3990
    assert run.evaluation_error == "engine failed"
    assert session.commits == 1


async def test_the_keys_of_the_references_are_read_once() -> None:
    session = FakeSession(reference_ids=[11, 22])
    repository = repository_on(session)

    await repository.record(result_of())
    await repository.record(result_of())

    assert len(session.added) == 2
    assert len(session.statements) == 2  # one lookup for the status, one for the profile


async def test_an_unknown_status_is_refused_and_nothing_is_added() -> None:
    session = FakeSession(reference_ids=[])

    with pytest.raises(NoResultFound):
        await repository_on(session).record(result_of("UNHEARD_OF"))

    assert session.added == []
    assert session.commits == 0


async def test_the_runs_are_mapped_newest_first_and_an_open_run_ends_when_it_starts() -> None:
    session = FakeSession(runs=[stored_run(60, ended=False), stored_run(0, error="boom")])

    runs = await repository_on(session).runs(limit=2)

    assert [run.started_at for run in runs] == [T0 + timedelta(seconds=60), T0]
    assert runs[0].ended_at == runs[0].started_at
    assert runs[1].ended_at == T0 + timedelta(seconds=5)
    assert (runs[1].status, runs[1].profile, runs[1].error) == ("SUCCESS", "ILE_DE_FRANCE", "boom")
    sql = session.sql()
    assert "DESC" in sql
    assert "LIMIT" in sql
    assert '"EXECUTION_COLLECTE"."DT_DEBUT" <' not in sql


async def test_the_paging_keeps_the_runs_started_before_the_cursor() -> None:
    session = FakeSession(runs=[stored_run()])

    await repository_on(session).runs(limit=5, before=T0)

    assert '"EXECUTION_COLLECTE"."DT_DEBUT" <' in session.sql()


async def test_the_last_success_is_the_latest_collected_run() -> None:
    session = FakeSession(runs=[stored_run(30, status="PARTIAL")])

    found = await repository_on(session).last_success()

    assert found is not None
    assert (found.status, found.started_at) == ("PARTIAL", T0 + timedelta(seconds=30))
    assert " IN " in session.sql()


async def test_there_is_no_last_success_before_the_first_collected_run() -> None:
    assert await repository_on(FakeSession(runs=[])).last_success() is None


async def test_the_pause_state_comes_from_the_single_parameter_row() -> None:
    parameter = CollectionParameter(is_paused=True, changed_at=T0, changed_by_id=4)

    state = await repository_on(FakeSession(parameter=parameter)).pause_state()

    assert state == PauseState(True, T0, 4)


async def test_pausing_updates_the_parameter_row_and_commits() -> None:
    parameter = CollectionParameter(is_paused=False, changed_at=None, changed_by_id=None)
    session = FakeSession(parameter=parameter)

    state = await repository_on(session).set_paused(True, T0, user_id=9)

    assert state == PauseState(True, T0, 9)
    assert (parameter.is_paused, parameter.changed_at, parameter.changed_by_id) == (True, T0, 9)
    assert session.commits == 1


def test_the_application_state_store_is_the_shared_database_store() -> None:
    assert get_state_store() is run_repository.state_store
    assert isinstance(get_state_store(), DatabaseCollectionStateStore)
