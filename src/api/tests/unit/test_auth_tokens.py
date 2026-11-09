from datetime import UTC, datetime, timedelta

import jwt
import pytest

from config.auth import AuthSettings
from services.auth.throttle import LoginThrottle
from services.auth.tokens import (
    AccessClaims,
    AccessTokenCodec,
    InvalidTokenError,
    RefreshTokens,
)
from tests.auth_support import SECRET, SETTINGS

NOW = datetime.now(UTC)


def test_an_access_token_round_trips() -> None:
    codec = AccessTokenCodec(SETTINGS)
    claims = AccessClaims("01JBZ0000000000000000000AB", "USER")

    assert codec.decode(codec.encode(claims, NOW)) == claims


def test_a_short_secret_is_refused() -> None:
    with pytest.raises(RuntimeError):
        AccessTokenCodec(AuthSettings(AUTH_JWT_SECRET="short"))


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        jwt.encode({"sub": "x", "role": "USER", "iat": NOW, "exp": NOW}, SECRET, "HS256"),
        jwt.encode(
            {"sub": "x", "role": "USER", "iat": NOW, "exp": NOW + timedelta(minutes=5)},
            "another-secret-with-at-least-32-chars",
            "HS256",
        ),
        jwt.encode({"sub": "x", "exp": NOW + timedelta(minutes=5)}, SECRET, "HS256"),
    ],
)
def test_bad_tokens_are_refused(token: str) -> None:
    with pytest.raises(InvalidTokenError):
        AccessTokenCodec(SETTINGS).decode(token)


def test_the_none_algorithm_is_refused() -> None:
    token = jwt.encode({"sub": "x", "role": "SUPERVISOR"}, None, algorithm="none")

    with pytest.raises(InvalidTokenError):
        AccessTokenCodec(SETTINGS).decode(token)


def test_refresh_tokens_are_random_and_hashed() -> None:
    first, second = RefreshTokens.generate(), RefreshTokens.generate()

    assert first != second
    assert len(RefreshTokens.hash(first)) == 64
    assert RefreshTokens.hash(first) == RefreshTokens.hash(first)


def test_the_throttle_forgets_old_failures() -> None:
    throttle = LoginThrottle(2, timedelta(minutes=15))
    throttle.record_attempt("a@b.c", "ip", NOW)
    throttle.record_attempt("a@b.c", "ip", NOW)

    assert throttle.is_blocked("a@b.c", "ip", NOW)
    assert not throttle.is_blocked("a@b.c", "other-ip", NOW)
    assert not throttle.is_blocked("a@b.c", "ip", NOW + timedelta(minutes=15))


def test_the_throttle_prunes_expired_pairs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("services.auth.throttle.MAX_TRACKED_PAIRS", 2)
    throttle = LoginThrottle(5, timedelta(minutes=15))
    throttle.record_attempt("a@b.c", "ip", NOW)
    throttle.record_attempt("d@e.f", "ip", NOW)

    throttle.record_attempt("g@h.i", "ip", NOW + timedelta(hours=1))

    assert list(throttle._pairs) == [("g@h.i", "ip")]


def test_the_block_lasts_the_whole_lock() -> None:
    throttle = LoginThrottle(5, timedelta(minutes=15))
    throttle.record_attempt("a@b.c", "ip", NOW)
    for second in (56, 57, 58, 59):
        throttle.record_attempt("a@b.c", "ip", NOW + timedelta(minutes=14, seconds=second))
    blocked_at = NOW + timedelta(minutes=14, seconds=59)

    # The first failure leaves the window at 15:00, but the block keeps running.
    assert throttle.is_blocked("a@b.c", "ip", NOW + timedelta(minutes=15))
    assert throttle.is_blocked("a@b.c", "ip", blocked_at + timedelta(minutes=14, seconds=59))
    assert not throttle.is_blocked("a@b.c", "ip", blocked_at + timedelta(minutes=15))


def test_failures_spread_over_more_than_the_lock_do_not_block() -> None:
    throttle = LoginThrottle(2, timedelta(minutes=15))
    throttle.record_attempt("a@b.c", "ip", NOW)
    throttle.record_attempt("a@b.c", "ip", NOW + timedelta(minutes=15))

    assert not throttle.is_blocked("a@b.c", "ip", NOW + timedelta(minutes=15))


def test_the_oldest_live_pair_is_dropped_past_the_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("services.auth.throttle.MAX_TRACKED_PAIRS", 2)
    throttle = LoginThrottle(5, timedelta(minutes=15))
    for minute, email in enumerate(("a@b.c", "d@e.f", "g@h.i")):
        throttle.record_attempt(email, "ip", NOW + timedelta(minutes=minute))

    assert list(throttle._pairs) == [("d@e.f", "ip"), ("g@h.i", "ip")]
