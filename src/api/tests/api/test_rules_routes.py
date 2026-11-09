from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest

from core.security import CurrentUser, RoleCode, get_current_user
from main import app
from routes.v1.rules import get_rule_service
from schemas.rule import RuleOut, RuleUpdate
from services.rules.service import RuleNotFound

T0 = datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
R1 = RuleOut(
    code="R1",
    description="Délai trop long depuis le dernier contact",
    threshold=300.0,
    unit="s",
    criticality="MEDIUM",
    is_active=True,
    updated_at=T0,
)
SUPERVISOR = CurrentUser(id=7, public_id="01JC0000000000000000000U01", role=RoleCode.SUPERVISOR)


class FakeRuleService:
    def __init__(self) -> None:
        self.changes: RuleUpdate | None = None
        self.user_id: int | None = None

    async def list(self) -> list[RuleOut]:
        return [R1]

    async def get(self, code: str) -> RuleOut | None:
        return R1 if code == "R1" else None

    async def update(self, code: str, changes: RuleUpdate, user_id: int) -> RuleOut:
        if code != "R1":
            raise RuleNotFound(code)
        self.changes, self.user_id = changes, user_id
        return R1.model_copy(update=changes.model_dump(exclude_unset=True))


@pytest.fixture
def rules() -> FakeRuleService:
    return FakeRuleService()


def build_client(user: CurrentUser, rules: FakeRuleService) -> httpx.AsyncClient:
    async def current_user() -> CurrentUser:
        return user

    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_rule_service] = lambda: rules
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def api(rules: FakeRuleService) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with build_client(SUPERVISOR, rules) as client:
        yield client
    app.dependency_overrides.clear()


async def test_rules_need_an_authenticated_caller(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/v1/rules")).status_code == 401


async def test_rules_are_reserved_to_supervisors(rules: FakeRuleService) -> None:
    user = CurrentUser(id=2, public_id="01JC0000000000000000000U02", role=RoleCode.USER)
    async with build_client(user, rules) as client:
        responses = [
            await client.get("/api/v1/rules"),
            await client.get("/api/v1/rules/R1"),
            await client.patch("/api/v1/rules/R1", json={"threshold": 1}),
        ]
    app.dependency_overrides.clear()

    assert [response.status_code for response in responses] == [403] * 3
    assert rules.changes is None


async def test_list_returns_the_rules(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/v1/rules")

    assert response.status_code == 200
    assert response.json()[0]["code"] == "R1"
    assert response.json()[0]["threshold"] == 300.0


async def test_get_returns_one_rule_or_404(api: httpx.AsyncClient) -> None:
    assert (await api.get("/api/v1/rules/R1")).json()["unit"] == "s"
    assert (await api.get("/api/v1/rules/R99")).status_code == 404


async def test_update_changes_the_threshold(api: httpx.AsyncClient, rules: FakeRuleService) -> None:
    response = await api.patch("/api/v1/rules/R1", json={"threshold": 420})

    assert response.status_code == 200
    assert response.json()["threshold"] == 420.0
    assert rules.changes.model_fields_set == {"threshold"}
    assert rules.user_id == SUPERVISOR.id


async def test_update_can_clear_the_criticality(
    api: httpx.AsyncClient, rules: FakeRuleService
) -> None:
    response = await api.patch("/api/v1/rules/R1", json={"criticality": None})

    assert response.status_code == 200
    assert response.json()["criticality"] is None
    assert "criticality" in rules.changes.model_fields_set


async def test_update_answers_404_for_an_unknown_rule(api: httpx.AsyncClient) -> None:
    assert (await api.patch("/api/v1/rules/R99", json={"threshold": 1})).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"threshold": -1},
        {"threshold": 10_000_000},
        {"criticality": "SEVERE"},
        {"is_active": "maybe"},
        {"unit": "km"},
    ],
)
async def test_update_rejects_invalid_settings(api: httpx.AsyncClient, body: dict) -> None:
    assert (await api.patch("/api/v1/rules/R1", json=body)).status_code == 422
