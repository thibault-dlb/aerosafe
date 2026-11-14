from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest

from config.auth import settings as auth_settings
from core.security import RoleCode
from main import app
from services.auth.service import get_auth_service
from services.auth.store import get_user_store
from services.auth.tokens import AccessClaims, AccessTokenCodec
from services.users.service import get_user_service
from tests.auth_support import PASSWORD, SECRET, SETTINGS, FakeUserStore, build_service

NEW_PASSWORD = "another long passphrase"


@pytest.fixture
def store() -> FakeUserStore:
    return FakeUserStore()


@pytest.fixture
async def client(
    store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[httpx.AsyncClient, None]:
    from services.users.service import UserService

    monkeypatch.setattr(auth_settings, "AUTH_JWT_SECRET", SECRET)
    app.dependency_overrides[get_user_store] = lambda: store
    app.dependency_overrides[get_auth_service] = lambda: build_service(store)
    app.dependency_overrides[get_user_service] = lambda: UserService(store)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


def bearer(public_id: str, role: str) -> dict[str, str]:
    token = AccessTokenCodec(SETTINGS).encode(AccessClaims(public_id, role), datetime.now(UTC))
    return {"Authorization": f"Bearer {token}"}


async def supervisors(store: FakeUserStore) -> tuple[dict[str, str], dict[str, str]]:
    """Two Supervisors, as two sets of headers."""
    first = await store.seed("first@example.com", RoleCode.SUPERVISOR)
    second = await store.seed("second@example.com", RoleCode.SUPERVISOR)
    return bearer(first.public_id, RoleCode.SUPERVISOR), bearer(
        second.public_id, RoleCode.SUPERVISOR
    )


class TestList:
    async def test_a_supervisor_lists_the_accounts_with_their_state(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        gone = await store.seed("gone@example.com")
        gone.anonymised_at = datetime.now(UTC)

        response = await client.get("/api/v1/users", headers=first)

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 3
        by_email = {item["email"]: item for item in body["items"]}
        assert by_email["first@example.com"]["role"] == "SUPERVISOR"
        assert by_email["gone@example.com"]["is_anonymised"] is True
        assert by_email["first@example.com"]["is_anonymised"] is False
        assert "password_hash" not in by_email["first@example.com"]

    async def test_the_list_is_searched_and_paged(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        await store.seed("pilot@example.com")

        response = await client.get(
            "/api/v1/users", params={"search": "pilot", "limit": 1, "offset": 0}, headers=first
        )

        assert [item["email"] for item in response.json()["items"]] == ["pilot@example.com"]
        assert response.json()["total"] == 1

    async def test_a_user_is_refused(self, client: httpx.AsyncClient, store: FakeUserStore) -> None:
        member = await store.seed("member@example.com")

        response = await client.get("/api/v1/users", headers=bearer(member.public_id, "USER"))

        assert response.status_code == 403

    async def test_an_anonymous_caller_is_refused(self, client: httpx.AsyncClient) -> None:
        assert (await client.get("/api/v1/users")).status_code == 401


class TestCreate:
    async def test_the_password_is_returned_once_and_works_at_the_login(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.post(
            "/api/v1/users", json={"email": " New@Example.com ", "role": "USER"}, headers=first
        )

        assert response.status_code == 201
        body = response.json()
        assert body["account"]["email"] == "new@example.com"
        assert body["account"]["must_change_password"] is True
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "new@example.com", "password": body["temporary_password"]},
        )
        assert login.status_code == 200
        assert login.json()["user"]["must_change_password"] is True

    async def test_the_role_defaults_to_user(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.post(
            "/api/v1/users", json={"email": "new@example.com"}, headers=first
        )

        assert response.json()["account"]["role"] == "USER"

    async def test_a_taken_e_mail_gets_409(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.post(
            "/api/v1/users", json={"email": "second@example.com"}, headers=first
        )

        assert response.status_code == 409

    async def test_an_unknown_role_is_refused(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.post(
            "/api/v1/users", json={"email": "new@example.com", "role": "ROOT"}, headers=first
        )

        assert response.status_code == 422

    async def test_a_role_that_is_not_available_gets_422(
        self, client: httpx.AsyncClient, store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        first, _ = await supervisors(store)

        async def missing(_code: str):
            raise LookupError("inactive")

        monkeypatch.setattr(store, "get_role", missing)

        response = await client.post(
            "/api/v1/users", json={"email": "new@example.com"}, headers=first
        )

        assert response.status_code == 422

    async def test_a_user_is_refused(self, client: httpx.AsyncClient, store: FakeUserStore) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/users",
            json={"email": "new@example.com"},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 403


class TestUpdate:
    async def test_a_supervisor_changes_a_role_and_deactivates(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        member = await store.seed("member@example.com")

        response = await client.patch(
            f"/api/v1/users/{member.public_id}",
            json={"role": "SUPERVISOR", "is_active": False},
            headers=first,
        )

        assert response.status_code == 200
        assert response.json()["role"] == "SUPERVISOR"
        assert response.json()["is_active"] is False

    async def test_a_deactivated_account_loses_its_access_at_once(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        member = await store.seed("member@example.com")
        headers = bearer(member.public_id, "USER")
        assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 200

        await client.patch(
            f"/api/v1/users/{member.public_id}", json={"is_active": False}, headers=first
        )

        assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 401

    @pytest.mark.parametrize("body", [{"role": "USER"}, {"is_active": False}])
    async def test_a_supervisor_cannot_change_themselves(
        self, client: httpx.AsyncClient, store: FakeUserStore, body: dict
    ) -> None:
        me = await store.seed("me@example.com", RoleCode.SUPERVISOR)
        await store.seed("colleague@example.com", RoleCode.SUPERVISOR)

        response = await client.patch(
            f"/api/v1/users/{me.public_id}",
            json=body,
            headers=bearer(me.public_id, RoleCode.SUPERVISOR),
        )

        assert response.status_code == 403

    async def test_the_last_active_supervisor_gets_409(
        self, client: httpx.AsyncClient, store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Unreachable with one request at a time (the caller is a second active Supervisor):
        # it takes two Supervisors removing each other at once.
        first, _ = await supervisors(store)

        async def alone(_role: object) -> int:
            return 1

        monkeypatch.setattr(store, "count_active_in_role", alone)

        response = await client.patch(
            f"/api/v1/users/{store.users[1].public_id}", json={"is_active": False}, headers=first
        )

        assert response.status_code == 409

    async def test_an_anonymised_account_gets_409(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        member = await store.seed("member@example.com")
        member.anonymised_at = datetime.now(UTC)

        response = await client.patch(
            f"/api/v1/users/{member.public_id}", json={"is_active": True}, headers=first
        )

        assert response.status_code == 409

    async def test_an_unknown_account_gets_404(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.patch(
            "/api/v1/users/01JC0000000000000000000404", json={"is_active": True}, headers=first
        )

        assert response.status_code == 404

    async def test_a_role_that_is_not_available_gets_422(
        self, client: httpx.AsyncClient, store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        first, _ = await supervisors(store)
        member = await store.seed("member@example.com")

        async def missing(_code: str):
            raise LookupError("inactive")

        monkeypatch.setattr(store, "get_role", missing)

        response = await client.patch(
            f"/api/v1/users/{member.public_id}", json={"role": "SUPERVISOR"}, headers=first
        )

        assert response.status_code == 422


class TestAnonymise:
    async def test_a_supervisor_anonymises_an_account(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        member = await store.seed("member@example.com")

        response = await client.post(f"/api/v1/users/{member.public_id}/anonymise", headers=first)

        assert response.status_code == 200
        body = response.json()
        assert body["is_anonymised"] is True
        assert body["email"] == f"anonyme-{member.public_id}@aerosafe.invalid"
        assert body["is_active"] is False

    async def test_a_supervisor_cannot_anonymise_themselves_here(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.post(
            f"/api/v1/users/{store.users[0].public_id}/anonymise", headers=first
        )

        assert response.status_code == 403

    async def test_an_account_is_anonymised_once(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        member = await store.seed("member@example.com")
        await client.post(f"/api/v1/users/{member.public_id}/anonymise", headers=first)

        response = await client.post(f"/api/v1/users/{member.public_id}/anonymise", headers=first)

        assert response.status_code == 409

    async def test_an_unknown_account_gets_404(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)

        response = await client.post(
            "/api/v1/users/01JC0000000000000000000404/anonymise", headers=first
        )

        assert response.status_code == 404

    async def test_the_last_active_supervisor_gets_409(
        self, client: httpx.AsyncClient, store: FakeUserStore, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        first, _ = await supervisors(store)

        async def alone(_role: object) -> int:
            return 1

        monkeypatch.setattr(store, "count_active_in_role", alone)

        response = await client.post(
            f"/api/v1/users/{store.users[1].public_id}/anonymise", headers=first
        )

        assert response.status_code == 409


class TestMe:
    async def test_the_caller_reads_their_account(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.get("/api/v1/users/me", headers=bearer(member.public_id, "USER"))

        assert response.status_code == 200
        assert response.json() == {
            "id": member.public_id,
            "email": "member@example.com",
            "role": "USER",
            "is_active": True,
            "must_change_password": False,
        }

    async def test_the_account_is_readable_with_a_provisional_password(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.add_user(
            "new@example.com", "hash", store.roles[RoleCode.USER], temporary_password=True
        )

        response = await client.get("/api/v1/users/me", headers=bearer(member.public_id, "USER"))

        assert response.status_code == 200
        assert response.json()["must_change_password"] is True

    async def test_a_user_deletes_their_account_with_their_password(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/users/me/anonymise",
            json={"password": PASSWORD},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 204
        assert member.anonymised_at is not None
        assert "refresh_token=" in response.headers["set-cookie"]
        login = await client.post(
            "/api/v1/auth/login", json={"email": "member@example.com", "password": PASSWORD}
        )
        assert login.status_code == 401

    async def test_a_wrong_password_deletes_nothing(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/users/me/anonymise",
            json={"password": "wrong password!"},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 400
        assert member.anonymised_at is None

    async def test_too_many_wrong_passwords_get_429(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")
        strict = build_service(store, max_failures=1)
        app.dependency_overrides[get_auth_service] = lambda: strict
        headers = bearer(member.public_id, "USER")
        await client.post(
            "/api/v1/users/me/anonymise", json={"password": "wrong password!"}, headers=headers
        )

        response = await client.post(
            "/api/v1/users/me/anonymise", json={"password": PASSWORD}, headers=headers
        )

        assert response.status_code == 429

    async def test_the_last_active_supervisor_cannot_delete_their_account(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        boss = await store.seed("boss@example.com", RoleCode.SUPERVISOR)

        response = await client.post(
            "/api/v1/users/me/anonymise",
            json={"password": PASSWORD},
            headers=bearer(boss.public_id, RoleCode.SUPERVISOR),
        )

        assert response.status_code == 409
        assert boss.anonymised_at is None


class TestPassword:
    async def test_the_password_is_changed_and_a_new_session_opens(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 200
        assert response.json()["user"]["must_change_password"] is False
        assert "refresh_token=" in response.headers["set-cookie"]
        assert response.headers["cache-control"] == "no-store"
        old = await client.post(
            "/api/v1/auth/login", json={"email": "member@example.com", "password": PASSWORD}
        )
        new = await client.post(
            "/api/v1/auth/login", json={"email": "member@example.com", "password": NEW_PASSWORD}
        )
        assert (old.status_code, new.status_code) == (401, 200)

    async def test_a_provisional_password_is_the_way_out_of_the_lock(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        first, _ = await supervisors(store)
        created = await client.post(
            "/api/v1/users", json={"email": "new@example.com"}, headers=first
        )
        provisional = created.json()["temporary_password"]
        public_id = created.json()["account"]["id"]
        headers = bearer(public_id, "USER")
        assert (await client.get("/api/v1/aircraft", headers=headers)).status_code == 403

        changed = await client.post(
            "/api/v1/auth/password",
            json={"current_password": provisional, "new_password": NEW_PASSWORD},
            headers=headers,
        )

        assert changed.status_code == 200
        assert (await client.get("/api/v1/users/me", headers=headers)).json()[
            "must_change_password"
        ] is False

    async def test_a_wrong_current_password_gets_400(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/auth/password",
            json={"current_password": "wrong password!", "new_password": NEW_PASSWORD},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 400

    async def test_the_same_password_gets_422(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": PASSWORD},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 422

    async def test_a_short_password_gets_422(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")

        response = await client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": "short"},
            headers=bearer(member.public_id, "USER"),
        )

        assert response.status_code == 422

    async def test_too_many_failures_get_429(
        self, client: httpx.AsyncClient, store: FakeUserStore
    ) -> None:
        member = await store.seed("member@example.com")
        service = build_service(store, max_failures=1)
        app.dependency_overrides[get_auth_service] = lambda: service
        headers = bearer(member.public_id, "USER")
        body = {"current_password": "wrong password!", "new_password": NEW_PASSWORD}
        await client.post("/api/v1/auth/password", json=body, headers=headers)

        response = await client.post("/api/v1/auth/password", json=body, headers=headers)

        assert response.status_code == 429

    async def test_an_anonymous_caller_is_refused(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        )

        assert response.status_code == 401
