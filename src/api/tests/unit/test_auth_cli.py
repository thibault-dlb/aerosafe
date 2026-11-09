from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from core.security import RoleCode
from services.auth.cli import SupervisorCommand
from services.auth.service import hasher
from tests.auth_support import PASSWORD, FakeUserStore


async def test_creates_a_supervisor() -> None:
    store = FakeUserStore()

    message = await SupervisorCommand(store).run(" Chief@Example.com ", lambda: PASSWORD)

    user = store.users[0]
    assert message == "chief@example.com is now a Supervisor."
    assert user.role.code == RoleCode.SUPERVISOR
    assert hasher.verify(user.password_hash, PASSWORD)
    assert store.commits == 1


async def test_promotes_an_existing_account_without_asking_a_password() -> None:
    store = FakeUserStore()
    user = await store.seed("pilot@example.com")

    await SupervisorCommand(store).run("pilot@example.com", lambda: pytest.fail("asked"))

    assert user.role.code == RoleCode.SUPERVISOR
    assert user.role_id == store.roles[RoleCode.SUPERVISOR].id


@pytest.mark.parametrize(
    "change",
    [
        {"is_active": False},
        {"anonymised_at": datetime(2026, 11, 9, tzinfo=UTC), "password_hash": None},
    ],
)
async def test_does_not_promote_an_account_that_cannot_log_in(change: dict) -> None:
    store = FakeUserStore()
    user = await store.seed("pilot@example.com")
    for name, value in change.items():
        setattr(user, name, value)

    message = await SupervisorCommand(store).run("pilot@example.com", lambda: pytest.fail("asked"))

    assert "deactivated or anonymised" in message
    assert user.role.code == RoleCode.USER
    assert store.commits == 0


async def test_refuses_a_short_password() -> None:
    with pytest.raises(ValidationError):
        await SupervisorCommand(FakeUserStore()).run("chief@example.com", lambda: "short")


async def test_reports_an_email_held_by_a_deleted_account() -> None:
    store = FakeUserStore()
    store.add_user = AsyncMock(side_effect=IntegrityError("INSERT", {}, Exception()))

    message = await SupervisorCommand(store).run("chief@example.com", lambda: PASSWORD)

    assert "deleted account" in message
    assert store.commits == 0
