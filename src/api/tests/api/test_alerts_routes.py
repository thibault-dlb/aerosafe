from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.alerts import get_alert_service
from schemas.alert import AlertOut, AlertPage
from services.alerts.service import (
    AlertAlreadyProcessed,
    AlertFilters,
    AlertNotFound,
    AlertSort,
    AlertStatistics,
    AlertStatus,
)

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
ALERT = AlertOut(
    id="01JC0000000000000000000A01",
    aircraft_id="01JC0000000000000000000001",
    icao24="3c6444",
    rule_code="R1",
    rule_description="Délai trop long depuis le dernier contact",
    triggered_at=T0,
    observed_value=420.0,
    threshold=300.0,
    unit="s",
    message="R1 delay since the last contact for 3c6444",
    criticality="MEDIUM",
)
PROCESSED = ALERT.model_copy(update={"processed_at": T0})
SUPERVISOR = CurrentUser(id=7, public_id="01JC0000000000000000000U01", role=RoleCode.SUPERVISOR)


class FakeAlertService:
    def __init__(self) -> None:
        self.filters: AlertFilters | None = None
        self.period: tuple[datetime, datetime] | None = None
        self.processed_by: int | None = None

    async def search(self, filters: AlertFilters) -> AlertPage:
        self.filters = filters
        return AlertPage(items=[ALERT], total=1)

    async def get(self, public_id: str) -> AlertOut | None:
        return ALERT if public_id == ALERT.id else None

    async def mark_processed(self, public_id: str, user_id: int) -> AlertOut:
        if public_id == "processed":
            raise AlertAlreadyProcessed(public_id)
        if public_id != ALERT.id:
            raise AlertNotFound(public_id)
        self.processed_by = user_id
        return PROCESSED

    async def statistics(self, start: datetime, end: datetime) -> AlertStatistics:
        self.period = (start, end)
        return AlertStatistics(total=3, per_rule={"R1": 2, "R3": 1})


@pytest.fixture
def alerts() -> FakeAlertService:
    return FakeAlertService()


def build_client(user: CurrentUser, alerts: FakeAlertService) -> httpx.AsyncClient:
    async def current_user() -> CurrentUser:
        return user

    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_alert_service] = lambda: alerts
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def api(alerts: FakeAlertService) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with build_client(SUPERVISOR, alerts) as client:
        yield client
    app.dependency_overrides.clear()


async def test_alerts_need_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/v1/alerts")).status_code == 401


async def test_alerts_are_reserved_to_supervisors(alerts: FakeAlertService) -> None:
    user = CurrentUser(id=2, public_id="01JC0000000000000000000U02", role=RoleCode.USER)
    async with build_client(user, alerts) as client:
        responses = [
            await client.get("/api/v1/alerts"),
            await client.get("/api/v1/alerts/statistics"),
            await client.get(f"/api/v1/alerts/{ALERT.id}"),
            await client.post(f"/api/v1/alerts/{ALERT.id}/process"),
        ]
    app.dependency_overrides.clear()

    assert [response.status_code for response in responses] == [403] * 4


async def test_list_passes_the_filters(api: httpx.AsyncClient, alerts: FakeAlertService) -> None:
    response = await api.get(
        "/api/v1/alerts",
        params={
            "rule": "R1",
            "status": "unprocessed",
            "criticality": "MEDIUM",
            "icao24": "3c6",
            "sort": "criticality",
            "order": "asc",
            "limit": 10,
            "offset": 20,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == ALERT.id
    assert body["items"][0]["observed_value"] == 420.0
    assert alerts.filters == AlertFilters(
        rule_code="R1",
        status=AlertStatus.UNPROCESSED,
        criticality="MEDIUM",
        icao24="3c6",
        sort=AlertSort.CRITICALITY,
        descending=False,
        limit=10,
        offset=20,
    )


@pytest.mark.parametrize(
    "params",
    [
        {"status": "unknown"},
        {"criticality": "SEVERE"},
        {"icao24": "xyz"},
        {"sort": "aircraft"},
        {"order": "up"},
        {"limit": 0},
        {"limit": 201},
        {"offset": -1},
        {"start": "2026-11-09T10:00:00Z", "end": "2026-11-09T09:00:00Z"},
        {"start": "2026-11-09T10:00:00", "end": "2026-11-10T00:00:00Z"},
    ],
)
async def test_list_rejects_invalid_criteria(api: httpx.AsyncClient, params: dict) -> None:
    assert (await api.get("/api/v1/alerts", params=params)).status_code == 422


async def test_get_returns_the_details(api: httpx.AsyncClient) -> None:
    response = await api.get(f"/api/v1/alerts/{ALERT.id}")

    assert response.status_code == 200
    assert response.json()["message"] == ALERT.message
    assert response.json()["threshold"] == 300.0


async def test_get_answers_404_for_an_unknown_alert(api: httpx.AsyncClient) -> None:
    assert (await api.get("/api/v1/alerts/unknown")).status_code == 404


async def test_process_records_the_supervisor(
    api: httpx.AsyncClient, alerts: FakeAlertService
) -> None:
    response = await api.post(f"/api/v1/alerts/{ALERT.id}/process")

    assert response.status_code == 200
    assert response.json()["processed_at"] is not None
    assert alerts.processed_by == SUPERVISOR.id


async def test_process_answers_404_and_409(api: httpx.AsyncClient) -> None:
    assert (await api.post("/api/v1/alerts/unknown/process")).status_code == 404
    assert (await api.post("/api/v1/alerts/processed/process")).status_code == 409


async def test_statistics_default_to_the_last_24_hours(
    api: httpx.AsyncClient, alerts: FakeAlertService
) -> None:
    response = await api.get("/api/v1/alerts/statistics")

    assert response.status_code == 200
    assert response.json()["per_rule"] == {"R1": 2, "R3": 1}
    assert response.json()["total"] == 3
    start, end = alerts.period
    assert end - start == timedelta(hours=24)


async def test_statistics_use_the_given_period(
    api: httpx.AsyncClient, alerts: FakeAlertService
) -> None:
    params = {"start": "2026-11-08T00:00:00Z", "end": "2026-11-09T00:00:00Z"}

    assert (await api.get("/api/v1/alerts/statistics", params=params)).status_code == 200
    assert alerts.period == (datetime(2026, 11, 8, tzinfo=UTC), datetime(2026, 11, 9, tzinfo=UTC))

    reversed_period = {"start": params["end"], "end": params["start"]}
    response = await api.get("/api/v1/alerts/statistics", params=reversed_period)
    assert response.status_code == 422


@pytest.mark.parametrize("params", [{"start": "2026-11-09T10:00:00"}, {"end": "2026-11-09T10:00"}])
async def test_statistics_reject_a_date_without_time_zone(
    api: httpx.AsyncClient, params: dict
) -> None:
    response = await api.get("/api/v1/alerts/statistics", params=params)
    assert response.status_code == 422
