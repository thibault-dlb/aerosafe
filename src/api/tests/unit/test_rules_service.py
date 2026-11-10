from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from models import AuditLog, Rule
from schemas.rule import RuleUpdate
from services.rules.service import CriticalityUnavailable, RuleNotFound, RuleService

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
AUDIT_UPDATE_ID = 7
USER_ID = 9


class FakeRow(SimpleNamespace):
    """A result row: the rule at index 0, the extra columns as attributes."""

    def __init__(self, rule: Rule, **columns: object) -> None:
        super().__init__(**columns)
        self._rule = rule

    def __getitem__(self, index: int) -> Rule:
        assert index == 0
        return self._rule


class FakeSession:
    """Answers `scalar` from a queue, in the order the service reads, and `execute` from rows."""

    def __init__(self, *scalars: object, rows: list[FakeRow] | None = None) -> None:
        self.scalar_values = list(scalars)
        self.rows = rows or []
        self.added: list[AuditLog] = []
        self.flushed = False
        self.committed = False

    async def scalar(self, _statement) -> object:
        return self.scalar_values.pop(0)

    async def execute(self, _statement) -> SimpleNamespace:
        return SimpleNamespace(
            all=lambda: self.rows, first=lambda: self.rows[0] if self.rows else None
        )

    def add(self, entry: AuditLog) -> None:
        self.added.append(entry)

    async def flush(self) -> None:
        self.flushed = True

    async def commit(self) -> None:
        self.committed = True


def rule(
    threshold: str = "120.000", criticality_id: int | None = None, is_active: bool = True
) -> Rule:
    return Rule(
        id=2,
        code="R2",
        description="Position too old",
        threshold=Decimal(threshold),
        unit_id=1,
        criticality_id=criticality_id,
        is_active=is_active,
        updated_at=T0,
    )


def row_of(rule_: Rule, criticality: str | None = None) -> FakeRow:
    return FakeRow(rule_, unit="s", criticality=criticality)


async def test_the_rules_are_listed_with_their_unit_and_criticality() -> None:
    session = FakeSession(rows=[row_of(rule(), "HIGH")])

    [listed] = await RuleService(session).list()

    assert (listed.code, listed.threshold, listed.unit, listed.criticality) == (
        "R2",
        120.0,
        "s",
        "HIGH",
    )
    assert listed.is_active is True


async def test_a_rule_is_read_by_its_code_or_not_found() -> None:
    found = await RuleService(FakeSession(rows=[row_of(rule())])).get("R2")
    missing = await RuleService(FakeSession(rows=[])).get("R9")

    assert found is not None and found.description == "Position too old"
    assert missing is None


async def test_updating_an_unknown_rule_is_refused() -> None:
    session = FakeSession(None)

    with pytest.raises(RuleNotFound):
        await RuleService(session).update("R9", RuleUpdate(threshold=10), USER_ID)

    assert not session.committed


async def test_a_new_threshold_is_rounded_and_audited_with_both_values() -> None:
    target = rule()
    session = FakeSession(target, AUDIT_UPDATE_ID, rows=[row_of(target)])

    updated = await RuleService(session).update("R2", RuleUpdate(threshold=150.1236), USER_ID)

    assert target.threshold == Decimal("150.124")
    [entry] = session.added
    assert entry.table_name == Rule.__tablename__
    assert (entry.record_id, entry.action_id, entry.user_id) == (2, AUDIT_UPDATE_ID, USER_ID)
    assert entry.old_values["threshold"] == "120.000"
    assert entry.new_values["threshold"] == "150.124"
    assert session.flushed and session.committed
    assert updated.code == "R2"


async def test_a_rule_can_be_switched_off() -> None:
    target = rule()
    session = FakeSession(target, AUDIT_UPDATE_ID, rows=[row_of(target)])

    await RuleService(session).update("R2", RuleUpdate(is_active=False), USER_ID)

    assert target.is_active is False
    [entry] = session.added
    assert (entry.old_values["is_active"], entry.new_values["is_active"]) == (True, False)


async def test_a_criticality_is_set_from_its_active_reference() -> None:
    target = rule()
    # rule, key of the criticality, its code read for the new snapshot, key of the audit action
    session = FakeSession(target, 3, "HIGH", AUDIT_UPDATE_ID, rows=[row_of(target, "HIGH")])

    updated = await RuleService(session).update("R2", RuleUpdate(criticality="HIGH"), USER_ID)

    assert target.criticality_id == 3
    [entry] = session.added
    assert (entry.old_values["criticality"], entry.new_values["criticality"]) == (None, "HIGH")
    assert updated.criticality == "HIGH"


async def test_a_criticality_missing_from_the_reference_table_is_refused() -> None:
    session = FakeSession(rule(), None)

    with pytest.raises(CriticalityUnavailable):
        await RuleService(session).update("R2", RuleUpdate(criticality="HIGH"), USER_ID)

    assert not session.committed
    assert session.added == []


async def test_a_criticality_set_to_null_is_removed() -> None:
    target = rule(criticality_id=3)
    # rule, code of the current criticality, key of the audit action
    session = FakeSession(target, "HIGH", AUDIT_UPDATE_ID, rows=[row_of(target)])

    await RuleService(session).update("R2", RuleUpdate(criticality=None), USER_ID)

    assert target.criticality_id is None
    [entry] = session.added
    assert (entry.old_values["criticality"], entry.new_values["criticality"]) == ("HIGH", None)


async def test_a_change_that_changes_nothing_writes_no_audit_entry() -> None:
    target = rule()
    session = FakeSession(target, rows=[row_of(target)])

    await RuleService(session).update("R2", RuleUpdate(threshold=120.0, is_active=True), USER_ID)

    assert session.added == []
    assert session.flushed and session.committed
