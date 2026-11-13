import pytest

from services.replay.clock import ReplayState
from services.replay.service import (
    BOUNDS_TTL_SECONDS,
    EVALUATION_STEP,
    InvalidSpeed,
    ReplayOutOfBounds,
    ReplayService,
    ReplayUnavailable,
)
from tests.replay_support import END, REAL, START, T0, Clock, MemoryReplayStore, seconds


class Ticks:
    """A monotonic clock moved by hand."""

    def __init__(self) -> None:
        self.value = 1000.0

    def __call__(self) -> float:
        return self.value


def service(store: MemoryReplayStore, clock: Clock | None = None, ticks: Ticks | None = None):
    return ReplayService(store, clock or Clock(), ticks or Ticks())


class TestStatus:
    async def test_without_replayed_data_nothing_is_available(self) -> None:
        status = await service(MemoryReplayStore(bounds=None)).status()

        assert not status.available
        assert status.start is None and status.end is None
        assert status.simulated_at is None

    async def test_before_any_start_the_period_is_known_but_the_clock_is_not_set(self) -> None:
        status = await service(MemoryReplayStore()).status()

        assert status.available
        assert (status.start, status.end) == (START, END)
        assert status.simulated_at is None
        assert status.paused
        assert status.allowed_speeds == (1, 10, 60)

    async def test_a_running_clock_is_read_at_the_real_time(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(ReplayState(T0, REAL, 10, False))
        replay = service(store, clock)
        clock.advance(seconds(30))

        status = await replay.status()

        assert status.simulated_at == T0 + seconds(300)
        assert not status.paused and not status.finished
        assert status.server_time == clock.moment

    async def test_a_clock_at_the_end_of_the_data_is_finished_and_paused(self) -> None:
        store = MemoryReplayStore(ReplayState(END - seconds(1), REAL, 60, False))
        clock = Clock()
        clock.advance(seconds(10))

        status = await service(store, clock).status()

        assert status.finished and status.paused
        assert status.simulated_at == END

    async def test_the_period_is_read_once_for_a_few_minutes(self) -> None:
        store = MemoryReplayStore()
        ticks = Ticks()
        replay = service(store, ticks=ticks)

        await replay.status()
        await replay.simulated_now()
        ticks.value += BOUNDS_TTL_SECONDS - 1
        await replay.status()
        assert store.bounds_reads == 1

        ticks.value += 2
        await replay.status()
        assert store.bounds_reads == 2


class TestStart:
    async def test_the_replay_starts_at_the_instant_asked(self) -> None:
        store = MemoryReplayStore()

        status = await service(store).start(T0, 10, user_id=7)

        saved = store.saved[-1]
        assert (saved.simulated_at, saved.changed_at, saved.speed) == (T0, REAL, 10)
        assert not saved.paused and saved.changed_by_id == 7
        # The first evaluation, one step after `evaluated_until`, is at the start itself.
        assert saved.evaluated_until + EVALUATION_STEP == T0
        assert status.simulated_at == T0

    async def test_the_alerts_of_an_earlier_run_are_cleaned_up_first(self) -> None:
        store = MemoryReplayStore()

        await service(store).start(T0, 1, user_id=None)

        assert store.resets == [T0]

    async def test_without_replayed_data_it_cannot_start(self) -> None:
        with pytest.raises(ReplayUnavailable):
            await service(MemoryReplayStore(bounds=None)).start(T0, 1, None)

    @pytest.mark.parametrize("at", [START - seconds(1), END + seconds(1)])
    async def test_an_instant_outside_the_data_is_refused(self, at) -> None:
        store = MemoryReplayStore()

        with pytest.raises(ReplayOutOfBounds):
            await service(store).start(at, 1, None)

        assert store.saved == [] and store.resets == []

    @pytest.mark.parametrize("speed", [0, 2, 3600, -1])
    async def test_a_speed_that_is_not_allowed_is_refused(self, speed: int) -> None:
        store = MemoryReplayStore()

        with pytest.raises(InvalidSpeed):
            await service(store).start(T0, speed, None)

        assert store.saved == []

    async def test_starting_again_replaces_the_run_in_progress(self) -> None:
        store = MemoryReplayStore(ReplayState(T0, REAL, 60, False))

        await service(store).start(START, 1, None)

        assert store.saved[-1].simulated_at == START
        assert store.resets == [START]


class TestPauseResumeAndSpeed:
    async def test_a_pause_keeps_the_time_reached_so_far(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(ReplayState(T0, REAL, 10, False))
        replay = service(store, clock)
        clock.advance(seconds(60))

        status = await replay.pause(user_id=3)

        saved = store.saved[-1]
        assert saved.simulated_at == T0 + seconds(600)
        assert saved.changed_at == clock.moment
        assert saved.paused and saved.changed_by_id == 3
        assert status.paused and status.simulated_at == T0 + seconds(600)

    async def test_the_time_stays_put_while_paused_and_goes_on_after_a_resume(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(ReplayState(T0, REAL, 1, False))
        replay = service(store, clock)
        clock.advance(seconds(10))
        await replay.pause(None)
        clock.advance(seconds(500))
        assert (await replay.status()).simulated_at == T0 + seconds(10)

        await replay.resume(None)
        clock.advance(seconds(5))

        assert (await replay.status()).simulated_at == T0 + seconds(15)

    async def test_a_new_speed_applies_from_the_time_reached(self) -> None:
        clock = Clock()
        store = MemoryReplayStore(ReplayState(T0, REAL, 1, False))
        replay = service(store, clock)
        clock.advance(seconds(10))

        await replay.set_speed(60, None)
        clock.advance(seconds(10))

        assert (await replay.status()).simulated_at == T0 + seconds(10) + seconds(600)

    async def test_an_unknown_speed_is_refused(self) -> None:
        with pytest.raises(InvalidSpeed):
            await service(MemoryReplayStore(ReplayState(T0, REAL))).set_speed(5, None)

    @pytest.mark.parametrize("action", ["pause", "resume"])
    async def test_nothing_can_be_paused_or_resumed_before_a_start(self, action: str) -> None:
        replay = service(MemoryReplayStore())

        with pytest.raises(ReplayUnavailable):
            await getattr(replay, action)(None)

    async def test_the_instant_of_the_clock_is_given_to_the_other_services(self) -> None:
        store = MemoryReplayStore(ReplayState(T0, REAL, 1, True))

        assert await service(store).simulated_now() == T0
        assert await service(MemoryReplayStore()).simulated_now() is None
