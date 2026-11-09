from collections import OrderedDict, deque
from datetime import datetime, timedelta

MAX_TRACKED_PAIRS = 10_000


class _PairState:
    """Recent failures of one (e-mail, address) pair, and the end of its block."""

    def __init__(self, max_failures: int) -> None:
        self.failures: deque[datetime] = deque(maxlen=max_failures)
        self.blocked_until: datetime | None = None


class LoginThrottle:
    """Blocks an (e-mail, client address) pair for `lock` after `max_failures` failures in `lock`.

    The pairs stay ordered by their latest failure, so the expired ones come first and pruning
    stops at the first live one. Past MAX_TRACKED_PAIRS live pairs, the oldest is dropped: memory
    stays bounded when many e-mails are tried.

    shortcut: counters live in memory, so they reset on restart and are not shared between
    API processes; move them to the database or Redis if the API ever runs several workers.
    """

    def __init__(self, max_failures: int, lock: timedelta) -> None:
        self._max_failures = max_failures
        self._lock = lock
        self._pairs: OrderedDict[tuple[str, str], _PairState] = OrderedDict()

    def is_blocked(self, email: str, address: str, now: datetime) -> bool:
        state = self._pairs.get((email, address))
        return state is not None and state.blocked_until is not None and now < state.blocked_until

    def record_failure(self, email: str, address: str, now: datetime) -> None:
        key = (email, address)
        state = self._pairs.pop(key, None) or _PairState(self._max_failures)
        state.failures.append(now)
        if len(state.failures) == self._max_failures and now - state.failures[0] < self._lock:
            # The block runs for the whole lock from the failure that triggers it.
            state.blocked_until = now + self._lock
        self._pairs[key] = state
        self._prune(now)

    def reset(self, email: str, address: str) -> None:
        self._pairs.pop((email, address), None)

    def _prune(self, now: datetime) -> None:
        # A pair expires one lock after its latest failure, which also ends any block it has.
        while self._pairs:
            _key, oldest = next(iter(self._pairs.items()))
            expired = now - oldest.failures[-1] >= self._lock
            if not expired and len(self._pairs) <= MAX_TRACKED_PAIRS:
                return
            self._pairs.popitem(last=False)
