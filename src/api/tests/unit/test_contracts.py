"""Checks the contracts between work packages stay empty but callable."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from config.auth import settings as auth_settings
from main import app, lifespan
from services.alerts.service import AlertService, AlertStatistics
from services.collection.scheduler import Scheduler
from services.rules.engine import RulesEngine
from tests.auth_support import SECRET

NOW = datetime(2026, 11, 7, tzinfo=UTC)


async def test_the_rules_engine_is_not_implemented_yet() -> None:
    with pytest.raises(NotImplementedError):
        await RulesEngine(AsyncMock()).evaluate(NOW)


async def test_alert_statistics_are_not_implemented_yet() -> None:
    with pytest.raises(NotImplementedError):
        await AlertService(AsyncMock()).statistics(NOW, NOW)


def test_alert_statistics_default_to_no_rule() -> None:
    assert AlertStatistics(total=0).per_rule == {}


async def test_the_scheduler_starts_and_stops() -> None:
    scheduler = Scheduler()

    await scheduler.start()
    await scheduler.stop()


async def test_the_application_runs_the_scheduler_during_its_lifespan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_settings, "AUTH_JWT_SECRET", SECRET)

    async with lifespan(app):
        pass


async def test_the_application_refuses_to_start_without_a_jwt_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_settings, "AUTH_JWT_SECRET", "")

    with pytest.raises(RuntimeError, match="AUTH_JWT_SECRET"):
        async with lifespan(app):
            pass
