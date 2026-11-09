from datetime import datetime, timedelta

MAX_TRACKED_PAIRS = 10_000


class LoginThrottle:
    """Blocks an (e-mail, client address) pair after too many failed logins.

    shortcut: counters live in memory, so they reset on restart and are not shared between
    API processes; move them to the database or Redis if the API ever runs several workers.
    """

    def __init__(self, max_failures: int, lock: timedelta) -> None:
        self._max_failures = max_failures
        self._lock = lock
        self._failures: dict[tuple[str, str], list[datetime]] = {}

    def _recent(self, key: tuple[str, str], now: datetime) -> list[datetime]:
        recent = [moment for moment in self._failures.get(key, []) if now - moment < self._lock]
        if recent:
            self._failures[key] = recent
        else:
            self._failures.pop(key, None)
        return recent

    def is_blocked(self, email: str, address: str, now: datetime) -> bool:
        return len(self._recent((email, address), now)) >= self._max_failures

    def record_failure(self, email: str, address: str, now: datetime) -> None:
        # Bound memory when many different e-mails are tried: drop expired entries.
        if len(self._failures) >= MAX_TRACKED_PAIRS:
            for stale in list(self._failures):
                self._recent(stale, now)
        key = (email, address)
        self._failures[key] = [*self._recent(key, now), now]

    def reset(self, email: str, address: str) -> None:
        self._failures.pop((email, address), None)
