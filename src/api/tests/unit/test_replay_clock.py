from datetime import timedelta

import pytest

from services.replay.clock import ReplayBounds, ReplayClock, ReplayState
from tests.replay_support import BOUNDS, END, REAL, START, T0, seconds


def state(**changes) -> ReplayState:
    values = {"simulated_at": T0, "changed_at": REAL, "speed": 1, "paused": False}
    values.update(changes)
    return ReplayState(**values)


class TestNow:
    def test_there_is_no_instant_before_the_first_start(self) -> None:
        clock = ReplayClock(ReplayState(), BOUNDS)

        assert clock.now(REAL) is None
        assert not clock.running(REAL)

    def test_a_paused_clock_stays_where_it_is(self) -> None:
        clock = ReplayClock(state(paused=True), BOUNDS)

        assert clock.now(REAL + timedelta(hours=5)) == T0

    @pytest.mark.parametrize(("speed", "gained"), [(1, 10), (10, 100), (60, 600)])
    def test_a_running_clock_gains_the_speed_for_each_real_second(
        self, speed: int, gained: int
    ) -> None:
        clock = ReplayClock(state(speed=speed), BOUNDS)

        assert clock.now(REAL + seconds(10)) == T0 + seconds(gained)

    def test_the_clock_never_goes_back_before_its_last_change(self) -> None:
        clock = ReplayClock(state(), BOUNDS)

        assert clock.now(REAL - seconds(30)) == T0

    def test_the_clock_stops_at_the_end_of_the_data(self) -> None:
        clock = ReplayClock(state(simulated_at=END - seconds(5), speed=60), BOUNDS)

        assert clock.now(REAL + timedelta(hours=1)) == END
        assert clock.finished(REAL + timedelta(hours=1))
        assert not clock.running(REAL + timedelta(hours=1))

    def test_without_bounds_the_clock_has_no_end(self) -> None:
        clock = ReplayClock(state(speed=60))

        assert clock.now(REAL + timedelta(hours=1)) == T0 + timedelta(hours=60)
        assert not clock.finished(REAL)

    def test_a_clock_that_moves_is_running(self) -> None:
        assert ReplayClock(state(), BOUNDS).running(REAL)
        assert not ReplayClock(state(paused=True), BOUNDS).running(REAL)

    def test_a_clock_without_a_change_instant_does_not_move(self) -> None:
        assert ReplayClock(state(changed_at=None), BOUNDS).now(REAL + seconds(60)) == T0


class TestBounds:
    def test_both_ends_are_inside(self) -> None:
        assert BOUNDS.contains(START)
        assert BOUNDS.contains(END)
        assert not BOUNDS.contains(START - seconds(1))
        assert not BOUNDS.contains(END + seconds(1))

    def test_a_state_is_started_once_it_has_an_instant(self) -> None:
        assert not ReplayState().started
        assert ReplayState(simulated_at=T0).started
        assert ReplayBounds(START, END).start == START
