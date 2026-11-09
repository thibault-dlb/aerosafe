"""Checks the auth store against the migrated database."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import RoleCode
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
