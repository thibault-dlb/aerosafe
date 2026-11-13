from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from services.replay import scheduler as replay_scheduler
from services.replay.clock import ReplayState
from services.replay.scheduler import (
    ReplayEvaluator,
    ReplayScheduler,
    evaluate_in_transaction,
)
from services.replay.service import EVALUATION_STEP, ReplayService
from tests.replay_support import (
    END,
    REAL,
    T0,
    Clock,
    FakeSession,
    MemoryReplayStore,
    seconds,
    session_factory,
)


class Recorder:
    """Stands for the rules engine: records the steps and notes them in the store."""

    def __init__(self, store: MemoryReplayStore) -> None:
        self.store = store
        self.steps: list[datetime] = []

    async def __call__(self, _session, step: datetime) -> None:
        self.steps.append(step)
        self.store.mark_evaluated(step)


def evaluator(store: MemoryReplayStore, clock: Clock):
    recorder = Recorder(store)
    return (
        ReplayEvaluator(
            store,
            session_factory(FakeSession()),
            ReplayService(store, clock),
            recorder,
            clock,
        ),
        recorder,
    )


def running(simulated_at=T0, speed: int = 1, evaluated_until=None, paused: bool = False):
    return ReplayState(
        simulated_at, REAL, speed, paused, evaluated_until or simulated_at - EVALUATION_STEP
    )


class TestTick:
    async def test_nothing_is_evaluated_before_a_start(self) -> None:
        store = MemoryReplayStore()
        tick, recorder = evaluator(store, Clock())

        assert await tick.tick() == 0
        assert recorder.steps == []

    async def test_a_state_never_evaluated_from_the_start_is_left_alone(self) -> None:
        store = MemoryReplayStore(ReplayState(T0, REAL, 1, False, evaluated_until=None))
        tick, recorder = evaluator(store, Clock())

        assert await tick.tick() == 0
        assert recorder.steps == []

    async def test_the_first_step_is_the_start_itself(self) -> None:
        store = MemoryReplayStore(running())
        tick, recorder = evaluator(store, Clock())

        assert await tick.tick() == 1
        assert recorder.steps == [T0]

    async def test_every_step_that_went_by_is_evaluated_in_order(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(running(speed=10))
        tick, recorder = evaluator(store, clock)
        clock.advance(seconds(10))  # 100 simulated seconds: the steps T0, +30, +60, +90

        assert await tick.tick() == 4
        assert recorder.steps == [T0 + EVALUATION_STEP * n for n in range(4)]

    async def test_a_second_tick_goes_on_from_the_last_step(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(running())
        tick, recorder = evaluator(store, clock)
        await tick.tick()
        clock.advance(seconds(65))

        assert await tick.tick() == 2
        assert recorder.steps == [T0, T0 + EVALUATION_STEP, T0 + EVALUATION_STEP * 2]

    async def test_a_paused_clock_is_evaluated_up_to_where_it_stopped_and_no_further(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(running(paused=True))
        tick, recorder = evaluator(store, clock)
        clock.advance(seconds(3600))

        assert await tick.tick() == 1
        assert await tick.tick() == 0
        assert recorder.steps == [T0]

    async def test_the_end_of_the_data_stops_the_evaluation(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(running(simulated_at=END - seconds(40), speed=60))
        tick, recorder = evaluator(store, clock)
        clock.advance(seconds(3600))

        await tick.tick()

        assert recorder.steps[-1] <= END

    async def test_a_tick_stops_at_its_limit_and_the_next_one_goes_on(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(replay_scheduler, "MAX_STEPS_PER_TICK", 3)
        clock = Clock()
        store = MemoryReplayStore(running(speed=60))
        tick, recorder = evaluator(store, clock)
        clock.advance(seconds(10))  # 600 simulated seconds: 21 steps are due

        assert await tick.tick() == 3
        assert await tick.tick() == 3
        assert len(recorder.steps) == 6
        assert recorder.steps == sorted(recorder.steps)


class TestEvaluateInTransaction:
    async def test_the_evaluation_and_the_note_are_committed_together(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        calls: list[str] = []

        class FakeEngine:
            def __init__(self, session) -> None:
                calls.append("engine")

            async def evaluate(self, step, mode) -> None:
                calls.append(f"evaluate {mode.value}")

        async def record(session, until) -> None:
            calls.append("record")

        session = FakeSession()
        monkeypatch.setattr(replay_scheduler, "RulesEngine", FakeEngine)
        monkeypatch.setattr(replay_scheduler.DatabaseReplayStore, "record_evaluation", record)

        await evaluate_in_transaction(session, T0)

        assert calls == ["engine", "evaluate replay", "record"]
        assert session.commits == 1


class TestScheduler:
    async def test_it_registers_itself_and_is_removed_when_stopped(self) -> None:
        scheduler = ReplayScheduler(AsyncMock())

        await scheduler.start()
        assert ReplayScheduler.current() is scheduler
        await scheduler.stop()

        assert ReplayScheduler.current() is None

    async def test_a_failed_tick_is_logged_and_does_not_escape(self) -> None:
        failing = AsyncMock()
        failing.tick.side_effect = RuntimeError("boom")

        await ReplayScheduler(failing)._tick()

        failing.tick.assert_awaited_once()

    async def test_it_can_be_stopped_without_having_started(self) -> None:
        await ReplayScheduler(AsyncMock()).stop()
