from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from models import Role, User
from services.auth.store import UserStore, get_user_store


def session_returning(value: object) -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.scalar.return_value = value
    return session


def sql(session: AsyncMock) -> str:
    return str(session.scalar.await_args.args[0])


@pytest.mark.parametrize(
    "method, argument, column",
    [
        ("get_by_email", "a@b.c", '"LN_EMAIL"'),
        ("get_by_public_id", "01JBZ", '"CD_ULID"'),
        ("get_user", 3, '"UTILISATEUR"."ID"'),
    ],
)
async def test_user_reads_skip_deleted_rows(method: str, argument: object, column: str) -> None:
    session = session_returning("user")

    assert await getattr(UserStore(session), method)(argument) == "user"
    assert column in sql(session)
    assert "deleted_at IS NULL" in sql(session)


async def test_a_refresh_token_is_checked_and_revoked_in_one_update() -> None:
    session = session_returning(7)

    assert await UserStore(session).revoke_refresh_token("abc", datetime.now(UTC)) == 7
    statement = sql(session)
    assert statement.startswith('UPDATE "JETON_RAFRAICHISSEMENT"')
    for condition in (
        '"CD_HASH_JETON" =',
        '"DT_REVOCATION" IS NULL',
        '"DT_EXPIRATION" >',
        "deleted_at IS NULL",
    ):
        assert condition in statement
    assert 'RETURNING "JETON_RAFRAICHISSEMENT"."ID_UTILISATEUR"' in statement


async def test_a_missing_or_inactive_role_is_an_error() -> None:
    session = session_returning(None)

    with pytest.raises(LookupError):
        await UserStore(session).get_role("USER")
    assert '"R_ROLE".is_active IS true' in sql(session)


async def test_writes_flush_then_commit() -> None:
    session = session_returning(None)
    store = UserStore(session)
    role = Role(id=1, code="USER", label="User")

    user = await store.add_user("a@b.c", "hash", role)
    await store.add_refresh_token(user, "hash", datetime.now(UTC))
    await store.commit()

    assert user.role_id == 1
    assert session.add.call_count == 2
    session.commit.assert_awaited_once()
    assert await UserStore(session_returning(role)).get_role("USER") is role


def test_only_active_accounts_with_a_password_can_log_in() -> None:
    assert UserStore.can_log_in(User(is_active=True, password_hash="hash"))
    assert not UserStore.can_log_in(None)
    assert not UserStore.can_log_in(User(is_active=False, password_hash="hash"))
    assert not UserStore.can_log_in(User(is_active=True, password_hash=None))


def test_the_dependency_wraps_the_session() -> None:
    assert isinstance(get_user_store(AsyncMock()), UserStore)
