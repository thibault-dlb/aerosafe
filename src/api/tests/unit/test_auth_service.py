from datetime import UTC, datetime, timedelta

import pytest

from core.security import RoleCode
from services.auth.service import (
    EmailTakenError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    TooManyAttemptsError,
    hasher,
)
from services.auth.tokens import RefreshTokens
from tests.auth_support import PASSWORD, FakeUserStore, build_service

NOW = datetime(2026, 11, 9, 12, tzinfo=UTC)
ADDRESS = "10.0.0.1"


@pytest.fixture
def store() -> FakeUserStore:
    return FakeUserStore()


async def test_sign_up_creates_a_user_with_a_hashed_password(store: FakeUserStore) -> None:
    user = await build_service(store).sign_up("pilot@example.com", PASSWORD)

    assert user.role.code == RoleCode.USER
    assert user.password_hash != PASSWORD
    assert hasher.verify(user.password_hash, PASSWORD)
    assert store.commits == 1


async def test_sign_up_refuses_a_taken_email(store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")

    with pytest.raises(EmailTakenError):
        await build_service(store).sign_up("pilot@example.com", PASSWORD)


async def test_login_returns_tokens_and_stores_only_the_refresh_hash(store: FakeUserStore) -> None:
    user = await store.seed("pilot@example.com")

    session = await build_service(store).login("pilot@example.com", PASSWORD, ADDRESS, NOW)

    assert session.user is user
    assert session.access_token
    assert store.tokens[0].token_hash == RefreshTokens.hash(session.refresh_token)
    assert store.tokens[0].token_hash != session.refresh_token
    assert store.tokens[0].expires_at == NOW + timedelta(days=7)


@pytest.mark.parametrize(
    "email, password",
    [
        ("pilot@example.com", "wrong password!"),
        ("nobody@example.com", PASSWORD),
    ],
)
async def test_login_refuses_bad_credentials(
    store: FakeUserStore, email: str, password: str
) -> None:
    await store.seed("pilot@example.com")

    with pytest.raises(InvalidCredentialsError):
        await build_service(store).login(email, password, ADDRESS, NOW)


@pytest.mark.parametrize(
    "change",
    [
        {"is_active": False},
        {"anonymised_at": NOW, "password_hash": None},
    ],
)
async def test_login_refuses_an_account_that_cannot_log_in(
    store: FakeUserStore, change: dict
) -> None:
    user = await store.seed("pilot@example.com")
    for name, value in change.items():
        setattr(user, name, value)

    with pytest.raises(InvalidCredentialsError):
        await build_service(store).login("pilot@example.com", PASSWORD, ADDRESS, NOW)


async def test_login_is_blocked_after_too_many_failures(store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")
    service = build_service(store, max_failures=2)
    for _ in range(2):
        with pytest.raises(InvalidCredentialsError):
            await service.login("pilot@example.com", "wrong password!", ADDRESS, NOW)

    with pytest.raises(TooManyAttemptsError):
        await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)


async def test_a_successful_login_resets_the_failures(store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")
    service = build_service(store, max_failures=2)
    with pytest.raises(InvalidCredentialsError):
        await service.login("pilot@example.com", "wrong password!", ADDRESS, NOW)
    await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)

    with pytest.raises(InvalidCredentialsError):
        await service.login("pilot@example.com", "wrong password!", ADDRESS, NOW)
    await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)


async def test_refresh_rotates_the_token(store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")
    service = build_service(store)
    first = await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)

    second = await service.refresh(first.refresh_token, NOW + timedelta(minutes=20))

    assert second.refresh_token != first.refresh_token
    assert store.tokens[0].revoked_at == NOW + timedelta(minutes=20)
    with pytest.raises(InvalidRefreshTokenError):
        await service.refresh(first.refresh_token, NOW + timedelta(minutes=21))


async def test_refresh_refuses_an_unknown_or_expired_token(store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")
    service = build_service(store)
    session = await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)

    with pytest.raises(InvalidRefreshTokenError):
        await service.refresh("unknown", NOW)
    with pytest.raises(InvalidRefreshTokenError):
        await service.refresh(session.refresh_token, NOW + timedelta(days=7))


async def test_refresh_refuses_a_deactivated_account(store: FakeUserStore) -> None:
    user = await store.seed("pilot@example.com")
    service = build_service(store)
    session = await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)
    user.is_active = False

    with pytest.raises(InvalidRefreshTokenError):
        await service.refresh(session.refresh_token, NOW)


async def test_logout_revokes_the_token_once(store: FakeUserStore) -> None:
    await store.seed("pilot@example.com")
    service = build_service(store)
    session = await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)
    commits = store.commits

    await service.logout(session.refresh_token, NOW)
    await service.logout(session.refresh_token, NOW)
    await service.logout("unknown", NOW)

    assert store.tokens[0].revoked_at == NOW
    assert store.commits == commits + 1
