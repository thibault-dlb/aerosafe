from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from models import Alert
from services.alerts.service import (
    AlertAlreadyProcessed,
    AlertFilters,
    AlertNotFound,
    AlertService,
    AlertSort,
    AlertStatus,
)

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
ALERT_ID = "01JC0000000000000000000A01"


class FakeRow(SimpleNamespace):
    def __init__(self, alert: Alert, **columns) -> None:
        super().__init__(**columns)
        self._alert = alert

    def __getitem__(self, index: int) -> Alert:
        assert index == 0
        return self._alert


def alert_row(processed_at: datetime | None = None) -> FakeRow:
    alert = Alert(
        id=3,
        public_id=ALERT_ID,
        aircraft_id=1,
        rule_id=1,
        triggered_at=T0,
        observed_value=Decimal("420.000"),
        threshold=Decimal("300.000"),
        message="R1 delay since the last contact for 3c6444",
        processed_at=processed_at,
    )
    return FakeRow(
        alert,
        aircraft_public_id="01JC0000000000000000000001",
        icao24="3c6444",
        registration="D-AIBD",
        rule_code="R1",
        rule_description="Délai trop long depuis le dernier contact",
        unit="s",
        criticality="MEDIUM",
    )


def sql(statement) -> str:
    return str(
        statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )


def result(rows: list) -> MagicMock:
    value = MagicMock()
    value.all.return_value = rows
    value.first.return_value = rows[0] if rows else None
    return value


def test_filters_combine_every_criterion() -> None:
    filters = AlertFilters(
        rule_code="R3",
        status=AlertStatus.UNPROCESSED,
        criticality="HIGH",
        icao24="3C6",
        start=T0,
        end=T0 + timedelta(hours=1),
    )

    text = sql(AlertService.filter(AlertService(AsyncMock()).base_query(), filters))

    assert '"REGLE"."CD_REGLE" = \'R3\'' in text
    assert '"ALERTE"."DT_TRAITEMENT" IS NULL' in text
    assert '"R_CRITICITE"."CD_CRITICITE" = \'HIGH\'' in text
    assert "LIKE '3c6' || '%%'" in text or "LIKE '3c6%%'" in text
    assert '"ALERTE"."DT_DECLENCHEMENT" >=' in text
    assert '"ALERTE"."DT_DECLENCHEMENT" <=' in text
    assert '"ALERTE".deleted_at IS NULL' in text


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        (AlertStatus.ACTIVE, '"ALERTE"."DT_FIN_EPISODE" IS NULL'),
        (AlertStatus.PROCESSED, '"ALERTE"."DT_TRAITEMENT" IS NOT NULL'),
    ],
)
def test_filters_by_status(status: AlertStatus, expected: str) -> None:
    statement = AlertService.filter(
        AlertService(AsyncMock()).base_query(), AlertFilters(status=status)
    )

    assert expected in sql(statement)


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        (AlertSort.TRIGGERED_AT, 'ORDER BY "ALERTE"."DT_DECLENCHEMENT" DESC'),
        (AlertSort.RULE, 'ORDER BY "REGLE"."CD_REGLE" DESC'),
        (AlertSort.CRITICALITY, "ORDER BY CASE"),
    ],
)
def test_sorts_by_the_chosen_key(sort: AlertSort, expected: str) -> None:
    statement = AlertService.order(AlertService(AsyncMock()).base_query(), AlertFilters(sort=sort))

    assert expected in sql(statement)


def test_sorts_in_ascending_order_on_request() -> None:
    statement = AlertService.order(
        AlertService(AsyncMock()).base_query(), AlertFilters(descending=False)
    )

    assert 'ORDER BY "ALERTE"."DT_DECLENCHEMENT" ASC' in sql(statement)


def test_a_period_must_be_ordered() -> None:
    with pytest.raises(ValueError):
        AlertFilters(start=T0, end=T0 - timedelta(seconds=1))


async def test_search_returns_a_page_and_the_total() -> None:
    session = AsyncMock()
    session.scalar.return_value = 12
    session.execute.return_value = result([alert_row()])

    page = await AlertService(session).search(AlertFilters(limit=1))

    assert page.total == 12
    [alert] = page.items
    assert alert.id == ALERT_ID
    assert alert.rule_code == "R1"
    assert alert.observed_value == 420.0
    assert alert.threshold == 300.0
    assert alert.unit == "s"
    assert alert.criticality == "MEDIUM"
    assert alert.processed_at is None


async def test_get_returns_none_for_an_unknown_alert() -> None:
    session = AsyncMock()
    session.execute.return_value = result([])

    assert await AlertService(session).get("unknown") is None


async def test_mark_processed_records_the_user_and_commits() -> None:
    row = alert_row()
    session = AsyncMock()
    session.scalar.return_value = row[0]
    session.execute.return_value = result([row])

    processed = await AlertService(session).mark_processed(ALERT_ID, user_id=42)

    assert row[0].processed_by_id == 42
    assert row[0].processed_at is not None
    assert processed.processed_at == row[0].processed_at
    session.commit.assert_awaited_once()


async def test_mark_processed_refuses_an_unknown_alert() -> None:
    session = AsyncMock()
    session.scalar.return_value = None

    with pytest.raises(AlertNotFound):
        await AlertService(session).mark_processed(ALERT_ID, user_id=42)


async def test_mark_processed_refuses_an_alert_already_processed() -> None:
    session = AsyncMock()
    session.scalar.return_value = alert_row(processed_at=T0)[0]

    with pytest.raises(AlertAlreadyProcessed):
        await AlertService(session).mark_processed(ALERT_ID, user_id=42)
    session.commit.assert_not_called()


async def test_statistics_count_the_alerts_per_rule() -> None:
    session = AsyncMock()
    session.execute.return_value = result([("R1", 4), ("R3", 1)])

    statistics = await AlertService(session).statistics(T0, T0 + timedelta(days=1))

    assert statistics.total == 5
    assert statistics.per_rule == {"R1": 4, "R3": 1}
