from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Select, case, func, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from core.repository import Repository
from models import Aircraft, Alert, Criticality, Rule, Unit
from schemas.alert import AlertOut, AlertPage


@dataclass(frozen=True)
class AlertStatistics:
    """Number of alerts over a period, in total and per rule code."""

    total: int
    per_rule: dict[str, int] = field(default_factory=dict)


class AlertSort(StrEnum):
    TRIGGERED_AT = "triggered_at"
    CRITICALITY = "criticality"
    RULE = "rule"


class AlertStatus(StrEnum):
    """`active`: the situation lasts. `unprocessed`/`processed`: the Supervisor's follow-up."""

    ACTIVE = "active"
    UNPROCESSED = "unprocessed"
    PROCESSED = "processed"


@dataclass(frozen=True)
class AlertFilters:
    """Criteria of the alert list. Every criterion is optional and they are combined (AND)."""

    rule_code: str | None = None
    status: AlertStatus | None = None
    criticality: str | None = None
    icao24: str | None = None
    start: datetime | None = None
    end: datetime | None = None
    sort: AlertSort = AlertSort.TRIGGERED_AT
    descending: bool = True
    limit: int = 50
    offset: int = 0

    def __post_init__(self) -> None:
        if self.start and self.end and self.start > self.end:
            raise ValueError("The start of the period must not be after its end")


class AlertNotFound(Exception):
    """No active alert has this identifier."""


class AlertAlreadyProcessed(Exception):
    """The alert was already marked as processed."""


# Most critical first when sorting in descending order; alerts without criticality last.
CRITICALITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}


class AlertService:
    """Single access point to alerts for the other work packages."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._alerts = Repository(session, Alert)

    def base_query(self) -> Select:
        """Active alerts with their aircraft, rule, unit and criticality."""
        return (
            self._alerts.select()
            .add_columns(
                Aircraft.public_id.label("aircraft_public_id"),
                Aircraft.icao24,
                Aircraft.registration,
                Rule.code.label("rule_code"),
                Rule.description.label("rule_description"),
                Unit.code.label("unit"),
                Criticality.code.label("criticality"),
            )
            .join(Aircraft, Alert.aircraft_id == Aircraft.id)
            .join(Rule, Alert.rule_id == Rule.id)
            .join(Unit, Rule.unit_id == Unit.id)
            .outerjoin(Criticality, Alert.criticality_id == Criticality.id)
        )

    @staticmethod
    def filter(statement: Select, filters: AlertFilters) -> Select:
        if filters.rule_code:
            statement = statement.where(Rule.code == filters.rule_code)
        if filters.criticality:
            statement = statement.where(Criticality.code == filters.criticality)
        if filters.icao24:
            statement = statement.where(Aircraft.icao24.startswith(filters.icao24.lower()))
        if filters.start:
            statement = statement.where(Alert.triggered_at >= filters.start)
        if filters.end:
            statement = statement.where(Alert.triggered_at <= filters.end)
        if filters.status is AlertStatus.ACTIVE:
            statement = statement.where(Alert.episode_ended_at.is_(None))
        elif filters.status is AlertStatus.UNPROCESSED:
            statement = statement.where(Alert.processed_at.is_(None))
        elif filters.status is AlertStatus.PROCESSED:
            statement = statement.where(Alert.processed_at.is_not(None))
        return statement

    @staticmethod
    def order(statement: Select, filters: AlertFilters) -> Select:
        if filters.sort is AlertSort.CRITICALITY:
            key = case(CRITICALITY_RANK, value=Criticality.code, else_=0)
        elif filters.sort is AlertSort.RULE:
            key = Rule.code
        else:
            key = Alert.triggered_at
        primary = key.desc() if filters.descending else key.asc()
        # The latest first among equals, then a stable order for the pagination.
        return statement.order_by(primary, Alert.triggered_at.desc(), Alert.id.desc())

    async def search(self, filters: AlertFilters) -> AlertPage:
        """Alerts matching the filters, sorted and paginated (BF-12)."""
        filtered = self.filter(self.base_query(), filters)
        total = await self._session.scalar(
            select(func.count()).select_from(filtered.order_by(None).subquery())
        )
        page = self.order(filtered, filters).limit(filters.limit).offset(filters.offset)
        rows = (await self._session.execute(page)).all()
        return AlertPage(items=[self.to_out(row) for row in rows], total=total or 0)

    async def get(self, public_id: str) -> AlertOut | None:
        """One alert with its details, or None if it does not exist."""
        row = (
            await self._session.execute(self.base_query().where(Alert.public_id == public_id))
        ).first()
        return None if row is None else self.to_out(row)

    async def mark_processed(self, public_id: str, user_id: int) -> AlertOut:
        """Record that a Supervisor processed the alert, in one transaction (UC-04).

        The row is locked, so two Supervisors processing it together cannot both succeed.
        """
        statement = (
            self._alerts.select().where(Alert.public_id == public_id).with_for_update(of=Alert)
        )
        alert = await self._session.scalar(statement)
        if alert is None:
            raise AlertNotFound(public_id)
        if alert.processed_at is not None:
            raise AlertAlreadyProcessed(public_id)
        alert.processed_at = datetime.now(UTC)
        alert.processed_by_id = user_id
        await self._session.flush()
        processed = await self.get(public_id)
        await self._session.commit()
        assert processed is not None
        return processed

    async def statistics(self, start: datetime, end: datetime) -> AlertStatistics:
        """Count the alerts triggered between `start` and `end`, for the dashboard."""
        statement = (
            select(Rule.code, func.count(Alert.id))
            .select_from(Alert)
            .join(Rule, Alert.rule_id == Rule.id)
            .where(
                Alert.deleted_at.is_(None),
                Alert.triggered_at >= start,
                Alert.triggered_at <= end,
            )
            .group_by(Rule.code)
            .order_by(Rule.code)
        )
        rows = (await self._session.execute(statement)).all()
        per_rule = {code: count for code, count in rows}
        return AlertStatistics(total=sum(per_rule.values()), per_rule=per_rule)

    @staticmethod
    def to_out(row: Row) -> AlertOut:
        alert: Alert = row[0]
        return AlertOut(
            id=alert.public_id,
            aircraft_id=row.aircraft_public_id,
            icao24=row.icao24,
            registration=row.registration,
            rule_code=row.rule_code,
            rule_description=row.rule_description,
            triggered_at=alert.triggered_at,
            episode_ended_at=alert.episode_ended_at,
            observed_value=None if alert.observed_value is None else float(alert.observed_value),
            threshold=None if alert.threshold is None else float(alert.threshold),
            unit=row.unit,
            message=alert.message,
            criticality=row.criticality,
            processed_at=alert.processed_at,
        )
