"""Checks the auth store against the migrated database."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.models import new_ulid
from core.security import RoleCode
from models import AuditLog
from services.auth.store import UserStore

pytestmark = pytest.mark.integration


async def test_a_new_user_reads_back_with_its_role(session: AsyncSession) -> None:
    store = UserStore(session)
    role = await store.get_role(RoleCode.USER)

    user = await store.add_user("integration@example.com", "hash", role)
    await store.commit()

    assert user.is_active is True
    found = await store.get_by_public_id(user.public_id)
    assert found is not None
    assert found.role.code == RoleCode.USER
    assert (await store.get_by_email("integration@example.com")).id == user.id
    assert UserStore.can_log_in(found)


async def test_the_email_is_unique(session: AsyncSession) -> None:
    store = UserStore(session)
    role = await store.get_role(RoleCode.USER)
    await store.add_user("twice@example.com", "hash", role)

    with pytest.raises(IntegrityError):
        await store.add_user("twice@example.com", "hash", role)


async def test_a_refresh_token_is_revoked_only_once(session: AsyncSession) -> None:
    store = UserStore(session)
    user = await store.add_user(
        "token@example.com", "hash", await store.get_role(RoleCode.SUPERVISOR)
    )
    now = datetime.now(UTC)
    await store.add_refresh_token(user, "a" * 64, now + timedelta(days=7))
    await store.add_refresh_token(user, "b" * 64, now - timedelta(seconds=1))

    assert await store.revoke_refresh_token("a" * 64, now) == user.id
    assert await store.revoke_refresh_token("a" * 64, now) is None
    assert await store.revoke_refresh_token("b" * 64, now) is None
    assert await store.revoke_refresh_token("unknown", now) is None


async def test_a_provisional_password_is_remembered_until_it_is_replaced(
    session: AsyncSession,
) -> None:
    store = UserStore(session)
    role = await store.get_role(RoleCode.USER)
    plain = await store.add_user("plain@example.com", "hash", role)
    provisional = await store.add_user(
        "provisional@example.com", "hash", role, temporary_password=True
    )
    await store.commit()

    assert plain.must_change_password is False
    found = await store.get_by_public_id(provisional.public_id)
    assert found is not None
    assert found.must_change_password is True


async def test_accounts_are_searched_by_e_mail_and_paged(session: AsyncSession) -> None:
    store = UserStore(session)
    role = await store.get_role(RoleCode.USER)
    tag = new_ulid().lower()
    for letter in "ab":
        await store.add_user(f"{letter}-{tag}@example.com", "hash", role)

    first, total = await store.search_users(tag, 1, 0)
    second, _ = await store.search_users(tag, 1, 1)
    none, none_total = await store.search_users(f"{tag}%", 10, 0)

    assert total == 2
    assert [user.email for user in first + second] == [
        f"a-{tag}@example.com",
        f"b-{tag}@example.com",
    ]
    assert first[0].role.code == RoleCode.USER
    # A wildcard typed in the search is a character, not a pattern.
    assert (none, none_total) == ([], 0)


async def test_an_account_is_locked_with_its_role(session: AsyncSession) -> None:
    store = UserStore(session)
    role = await store.get_role(RoleCode.SUPERVISOR)
    user = await store.add_user("lock@example.com", "hash", role)

    locked = await store.lock_by_public_id(user.public_id)

    assert locked is not None
    assert locked.role.code == RoleCode.SUPERVISOR
    assert await store.lock_by_public_id("01JC0000000000000000000404") is None


async def test_the_active_accounts_of_a_role_are_counted(session: AsyncSession) -> None:
    store = UserStore(session)
    role = await store.get_role(RoleCode.SUPERVISOR)
    before = await store.count_active_in_role(role)

    user = await store.add_user("count@example.com", "hash", role)
    assert await store.count_active_in_role(role) == before + 1

    user.is_active = False
    await session.flush()
    assert await store.count_active_in_role(role) == before


async def test_every_session_of_an_account_ends_at_once(session: AsyncSession) -> None:
    store = UserStore(session)
    user = await store.add_user("sessions@example.com", "hash", await store.get_role("USER"))
    other = await store.add_user("others@example.com", "hash", await store.get_role("USER"))
    now = datetime.now(UTC)
    for name in ("a", "b"):
        await store.add_refresh_token(user, name * 64, now + timedelta(days=7))
    await store.add_refresh_token(other, "c" * 64, now + timedelta(days=7))

    await store.revoke_user_tokens(user.id, now)

    assert await store.revoke_refresh_token("a" * 64, now) is None
    assert await store.revoke_refresh_token("b" * 64, now) is None
    assert await store.revoke_refresh_token("c" * 64, now) == other.id


async def test_anonymising_erases_the_account_and_leaves_an_audit_trace(
    session: AsyncSession,
) -> None:
    store = UserStore(session)
    user = await store.add_user("erase@example.com", "hash", await store.get_role("USER"))
    now = datetime.now(UTC)
    await store.add_refresh_token(user, "d" * 64, now + timedelta(days=7))

    await store.anonymise(user, now, user.id)
    await session.flush()

    assert user.email == f"anonyme-{user.public_id}@aerosafe.invalid"
    assert user.password_hash is None
    assert user.anonymised_at == now
    assert not UserStore.can_log_in(user)
    assert await store.revoke_refresh_token("d" * 64, now) is None
    events = (
        await session.scalars(
            select(AuditLog).where(
                AuditLog.table_name == "UTILISATEUR", AuditLog.record_id == user.id
            )
        )
    ).all()
    assert [event.new_values for event in events] == [{"anonymised": True}]
    assert events[0].user_id == user.id
