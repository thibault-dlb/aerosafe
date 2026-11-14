from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

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


def statement_of(call: object) -> str:
    return str(call.args[0])


async def test_accounts_are_listed_oldest_first_with_their_total() -> None:
    session = AsyncMock()
    session.scalars.return_value = MagicMock(all=MagicMock(return_value=["a", "b"]))
    session.scalar.return_value = 7

    users, total = await UserStore(session).search_users("pilot", 50, 100)

    assert (users, total) == (["a", "b"], 7)
    listing = statement_of(session.scalars.await_args)
    assert 'ORDER BY "UTILISATEUR".created_at, "UTILISATEUR"."ID"' in listing
    assert "lower(" in listing.lower()
    assert "LIMIT" in listing and "OFFSET" in listing
    assert "deleted_at IS NULL" in listing
    counting = statement_of(session.scalar.await_args)
    assert "count(*)" in counting
    assert '"LN_EMAIL"' in counting


async def test_a_search_with_wildcards_is_searched_literally() -> None:
    session = AsyncMock()
    session.scalars.return_value = MagicMock(all=MagicMock(return_value=[]))
    session.scalar.return_value = 0

    await UserStore(session).search_users("100%_x\\", 10, 0)

    parameters = session.scalars.await_args.args[0].compile().params
    assert r"%100\%\_x\\%" in parameters.values()


async def test_a_list_without_search_has_no_e_mail_condition() -> None:
    session = AsyncMock()
    session.scalars.return_value = MagicMock(all=MagicMock(return_value=[]))
    session.scalar.return_value = None

    assert await UserStore(session).search_users(None, 10, 0) == ([], 0)
    assert "LIKE" not in statement_of(session.scalars.await_args).upper()


async def test_an_account_is_locked_with_its_role_for_a_change() -> None:
    session = session_returning("user")

    assert await UserStore(session).lock_by_public_id("01JBZ") == "user"
    select = session.scalar.await_args.args[0]
    # The role is joined: only the account row is locked, PostgreSQL refuses to lock the other.
    assert 'FOR UPDATE OF "UTILISATEUR"' in str(select.compile(dialect=postgresql.dialect()))
    assert '"CD_ULID"' in str(select)
    assert "deleted_at IS NULL" in str(select)


async def test_the_active_accounts_of_a_role_are_counted() -> None:
    session = session_returning(2)

    assert await UserStore(session).count_active_in_role(Role(id=2, code="SUPERVISOR")) == 2
    statement = sql(session)
    for condition in ('"ID_ROLE" =', "is_active IS true", '"DT_ANONYMISATION" IS NULL'):
        assert condition in statement
    assert await UserStore(session_returning(None)).count_active_in_role(Role(id=2)) == 0


async def test_every_valid_token_of_an_account_is_revoked_at_once() -> None:
    session = AsyncMock()

    await UserStore(session).revoke_user_tokens(4, datetime.now(UTC))

    statement = statement_of(session.execute.await_args)
    assert statement.startswith('UPDATE "JETON_RAFRAICHISSEMENT"')
    assert '"DT_REVOCATION" IS NULL' in statement
    assert '"ID_UTILISATEUR" =' in statement


async def test_an_audit_event_names_the_account_the_action_and_the_actor() -> None:
    session = session_returning(3)
    session.add = MagicMock()
    user = User(id=9, public_id="01JBZ", email="a@b.c")

    await UserStore(session).record_audit(user, "update", {"a": 1}, {"a": 2}, 5)

    event = session.add.call_args.args[0]
    assert (event.table_name, event.record_id, event.action_id, event.user_id) == (
        "UTILISATEUR",
        9,
        3,
        5,
    )
    assert (event.old_values, event.new_values) == ({"a": 1}, {"a": 2})
    session.flush.assert_awaited()


async def test_anonymising_erases_the_account_and_keeps_no_e_mail_in_the_audit() -> None:
    session = session_returning(3)
    session.add = MagicMock()
    user = User(
        id=9,
        public_id="01JBZ",
        email="a@b.c",
        password_hash="hash",
        is_active=True,
        must_change_password=True,
    )
    now = datetime.now(UTC)

    await UserStore(session).anonymise(user, now, 5)

    assert user.email == "anonyme-01JBZ@aerosafe.invalid"
    assert user.password_hash is None
    assert (user.is_active, user.must_change_password, user.anonymised_at) == (False, False, now)
    event = session.add.call_args.args[0]
    assert event.new_values == {"anonymised": True}
    assert event.old_values is None
    session.execute.assert_awaited_once()
