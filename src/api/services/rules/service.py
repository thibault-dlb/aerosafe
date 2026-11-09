from decimal import Decimal

from sqlalchemy import Select, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import get_logger
from core.repository import Repository
from models import AuditAction, AuditLog, Criticality, Rule, Unit
from schemas.rule import RuleOut, RuleUpdate

logger = get_logger()


class RuleNotFound(Exception):
    """No active rule has this code."""


class RuleService:
    """Lists the business rules and changes their settings (UC-05).

    The engine reads the rules from the database on every evaluation, so a change applies
    at the next one. Each change is written to the audit log with the old and new values.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._rules = Repository(session, Rule)

    def base_query(self) -> Select:
        return (
            self._rules.select()
            .add_columns(Unit.code.label("unit"), Criticality.code.label("criticality"))
            .join(Unit, Rule.unit_id == Unit.id)
            .outerjoin(Criticality, Rule.criticality_id == Criticality.id)
        )

    async def list(self) -> list[RuleOut]:
        rows = (await self._session.execute(self.base_query().order_by(Rule.code))).all()
        return [self.to_out(row) for row in rows]

    async def get(self, code: str) -> RuleOut | None:
        # Reload the row: a database trigger sets `updated_at` on every change.
        statement = (
            self.base_query().where(Rule.code == code).execution_options(populate_existing=True)
        )
        row = (await self._session.execute(statement)).first()
        return None if row is None else self.to_out(row)

    async def update(self, code: str, changes: RuleUpdate, user_id: int) -> RuleOut:
        """Apply the changes of a Supervisor and record them in the audit log."""
        rule = await self._session.scalar(
            self._rules.select().where(Rule.code == code).with_for_update()
        )
        if rule is None:
            raise RuleNotFound(code)
        before = await self._snapshot(rule)

        fields = changes.model_fields_set
        if "threshold" in fields and changes.threshold is not None:
            rule.threshold = Decimal(str(changes.threshold)).quantize(Decimal("0.001"))
        if "is_active" in fields and changes.is_active is not None:
            rule.is_active = changes.is_active
        if "criticality" in fields:
            rule.criticality_id = await self._criticality_id(changes.criticality)

        after = await self._snapshot(rule)
        if after != before:
            action_id = await self._session.scalar(
                select(AuditAction.id).where(AuditAction.code == "update")
            )
            self._session.add(
                AuditLog(
                    table_name=Rule.__tablename__,
                    record_id=rule.id,
                    action_id=action_id,
                    old_values=before,
                    new_values=after,
                    user_id=user_id,
                )
            )
            logger.info("Rule {} changed by user {}: {} -> {}", code, user_id, before, after)
        await self._session.flush()
        updated = await self.get(code)
        await self._session.commit()
        assert updated is not None
        return updated

    async def _criticality_id(self, code: str | None) -> int | None:
        if code is None:
            return None
        return await self._session.scalar(
            select(Criticality.id).where(Criticality.code == code, Criticality.is_active.is_(True))
        )

    async def _snapshot(self, rule: Rule) -> dict[str, object]:
        criticality = None
        if rule.criticality_id is not None:
            criticality = await self._session.scalar(
                select(Criticality.code).where(Criticality.id == rule.criticality_id)
            )
        return {
            "threshold": str(rule.threshold),
            "is_active": rule.is_active,
            "criticality": criticality,
        }

    @staticmethod
    def to_out(row: Row) -> RuleOut:
        rule: Rule = row[0]
        return RuleOut(
            code=rule.code,
            description=rule.description,
            threshold=float(rule.threshold),
            unit=row.unit,
            criticality=row.criticality,
            is_active=rule.is_active,
            updated_at=rule.updated_at,
        )
