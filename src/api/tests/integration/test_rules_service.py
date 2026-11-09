"""RuleService against a real PostgreSQL, on the rules R1 to R5 inserted by the migrations."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import RoleCode
from models import AuditLog, Rule
from schemas.rule import RuleUpdate
from services.auth.store import UserStore
from services.rules.service import RuleNotFound, RuleService

pytestmark = pytest.mark.integration


async def supervisor_id(session: AsyncSession, email: str) -> int:
    store = UserStore(session)
    user = await store.add_user(email, "hash", await store.get_role(RoleCode.SUPERVISOR))
    return user.id


async def audit_of(session: AsyncSession, rule_code: str) -> list[AuditLog]:
    rule_id = await session.scalar(select(Rule.id).where(Rule.code == rule_code))
    statement = (
        select(AuditLog)
        .where(AuditLog.table_name == "REGLE", AuditLog.record_id == rule_id)
        .order_by(AuditLog.id)
    )
    return list(await session.scalars(statement))


async def test_lists_the_five_initial_rules(session: AsyncSession) -> None:
    rules = await RuleService(session).list()

    by_code = {rule.code: rule for rule in rules}
    assert {"R1", "R2", "R3", "R4", "R5"} <= set(by_code)
    assert (by_code["R1"].unit, by_code["R1"].criticality) == ("s", "MEDIUM")
    assert by_code["R3"].criticality == "HIGH"
    assert by_code["R4"].unit == "m/s²"


async def test_a_threshold_change_is_stored_and_audited(session: AsyncSession) -> None:
    user_id = await supervisor_id(session, "rules-threshold@example.com")
    before = await RuleService(session).get("R3")
    audited_before = len(await audit_of(session, "R3"))

    updated = await RuleService(session).update("R3", RuleUpdate(threshold=35.5), user_id)

    assert updated.threshold == 35.5
    assert updated.criticality == before.criticality
    [entry] = (await audit_of(session, "R3"))[audited_before:]
    assert entry.user_id == user_id
    assert entry.old_values["threshold"] == "30.000"
    assert entry.new_values["threshold"] == "35.500"


async def test_criticality_and_activation_can_change(session: AsyncSession) -> None:
    user_id = await supervisor_id(session, "rules-criticality@example.com")
    service = RuleService(session)

    updated = await service.update("R2", RuleUpdate(criticality="HIGH", is_active=False), user_id)
    assert (updated.criticality, updated.is_active) == ("HIGH", False)

    cleared = await service.update("R2", RuleUpdate.model_validate({"criticality": None}), user_id)
    assert cleared.criticality is None
    assert cleared.is_active is False


async def test_an_unchanged_rule_is_not_audited(session: AsyncSession) -> None:
    user_id = await supervisor_id(session, "rules-unchanged@example.com")
    audited_before = len(await audit_of(session, "R1"))

    await RuleService(session).update("R1", RuleUpdate(), user_id)

    assert len(await audit_of(session, "R1")) == audited_before


async def test_an_unknown_rule_is_refused(session: AsyncSession) -> None:
    with pytest.raises(RuleNotFound):
        await RuleService(session).update("R99", RuleUpdate(threshold=1), 1)
    assert await RuleService(session).get("R99") is None
