"""AlertService against a real PostgreSQL, on alerts raised by the engine."""

import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import RoleCode
from services.alerts.service import (
    AlertAlreadyProcessed,
    AlertFilters,
    AlertService,
    AlertSort,
    AlertStatus,
)
from services.auth.store import UserStore
from services.collection.flight_grouper import FlightGrouper
from services.collection.normalizer import NormalizedState
from services.collection.store import ObservationStore
from services.rules.engine import RulesEngine

pytestmark = pytest.mark.integration

NOW = datetime(2026, 11, 9, 10, tzinfo=UTC)


def state(aircraft: str, seconds_ago: int, altitude: str = "10000.0") -> NormalizedState:
    at = NOW - timedelta(seconds=seconds_ago)
    return NormalizedState(
        icao24=aircraft,
        callsign="AFR123",
        last_contact_at=at,
        position_at=at,
        latitude=49.0,
        longitude=2.5,
        altitude=Decimal(altitude),
        speed=Decimal("230.00"),
        heading=Decimal("90.00"),
        on_ground=False,
    )


async def raise_alerts(session: AsyncSession) -> tuple[str, str]:
    """One silent aircraft (R1) and one climbing steeply (R3)."""
    silent, climbing = secrets.token_hex(3), secrets.token_hex(3)
    store = ObservationStore(session, FlightGrouper(timedelta(minutes=30)))
    await store.save([state(silent, 420)])
    await store.save([state(climbing, 60)])
    await store.save([state(climbing, 30, altitude="11200.0")])
    await RulesEngine(session).evaluate(NOW)
    return silent, climbing


async def test_search_filters_and_sorts_the_alerts(session: AsyncSession) -> None:
    silent, climbing = await raise_alerts(session)
    service = AlertService(session)

    page = await service.search(AlertFilters(icao24=silent))
    [alert] = page.items
    assert page.total == 1
    assert (alert.rule_code, alert.unit, alert.criticality) == ("R1", "s", "MEDIUM")
    assert alert.observed_value == 420.0
    assert alert.threshold == 300.0

    by_rule = await service.search(AlertFilters(rule_code="R3", icao24=climbing))
    assert [item.icao24 for item in by_rule.items] == [climbing]

    by_criticality = await service.search(
        AlertFilters(sort=AlertSort.CRITICALITY, start=NOW, end=NOW, limit=200)
    )
    codes = [item.rule_code for item in by_criticality.items]
    assert codes.index("R3") < codes.index("R1")  # HIGH before MEDIUM.

    active = await service.search(AlertFilters(status=AlertStatus.ACTIVE, icao24=silent))
    assert active.total == 1


async def test_a_supervisor_processes_an_alert_once(session: AsyncSession) -> None:
    silent, _ = await raise_alerts(session)
    store = UserStore(session)
    supervisor = await store.add_user(
        f"{silent}@example.com", "hash", await store.get_role(RoleCode.SUPERVISOR)
    )
    service = AlertService(session)
    [alert] = (await service.search(AlertFilters(icao24=silent))).items

    processed = await service.mark_processed(alert.id, supervisor.id)

    assert processed.processed_at is not None
    with pytest.raises(AlertAlreadyProcessed):
        await service.mark_processed(alert.id, supervisor.id)
    remaining = await service.search(AlertFilters(status=AlertStatus.UNPROCESSED, icao24=silent))
    assert remaining.total == 0


async def test_statistics_count_the_alerts_of_the_period(session: AsyncSession) -> None:
    service = AlertService(session)
    before = await service.statistics(NOW, NOW)

    await raise_alerts(session)

    after = await service.statistics(NOW, NOW)
    assert after.total == before.total + 2
    assert after.per_rule["R1"] == before.per_rule.get("R1", 0) + 1
    assert after.per_rule["R3"] == before.per_rule.get("R3", 0) + 1
    assert (
        await service.statistics(NOW + timedelta(seconds=1), NOW + timedelta(hours=1))
    ).total == 0
