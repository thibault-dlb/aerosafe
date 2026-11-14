from datetime import UTC, datetime

import pytest

from core.security import RoleCode
from services.auth.service import (
    InvalidCredentialsError,
    LastSupervisorError,
    PasswordUnchangedError,
    TooManyAttemptsError,
    hasher,
)
from services.auth.tokens import RefreshTokens
from tests.auth_support import PASSWORD, FakeUserStore, build_service

NOW = datetime(2026, 11, 14, 12, tzinfo=UTC)
ADDRESS = "10.0.0.1"
NEW_PASSWORD = "another long passphrase"


@pytest.fixture
def store() -> FakeUserStore:
    return FakeUserStore()


class TestChangePassword:
    async def test_it_replaces_the_password_and_opens_a_new_session(
        self, store: FakeUserStore
    ) -> None:
        user = await store.seed("pilot@example.com")
        service = build_service(store)
        old = await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)

        session = await service.change_password(user.id, PASSWORD, NEW_PASSWORD, ADDRESS, NOW)

        assert hasher.verify(user.password_hash, NEW_PASSWORD)
        assert session.user is user
        by_hash = {token.token_hash: token for token in store.tokens}
        assert by_hash[RefreshTokens.hash(old.refresh_token)].revoked_at == NOW
        assert by_hash[RefreshTokens.hash(session.refresh_token)].revoked_at is None

    async def test_it_ends_the_provisional_state_of_the_password(
        self, store: FakeUserStore
    ) -> None:
        user = await store.add_user(
            "new@example.com",
            hasher.hash(PASSWORD),
            store.roles[RoleCode.USER],
            temporary_password=True,
        )

        await build_service(store).change_password(user.id, PASSWORD, NEW_PASSWORD, ADDRESS, NOW)

        assert user.must_change_password is False

    async def test_a_wrong_current_password_changes_nothing(self, store: FakeUserStore) -> None:
        user = await store.seed("pilot@example.com")
        before = user.password_hash

        with pytest.raises(InvalidCredentialsError):
            await build_service(store).change_password(
                user.id, "wrong password!", NEW_PASSWORD, ADDRESS, NOW
            )

        assert user.password_hash == before
        assert store.tokens == []

    async def test_the_new_password_must_differ(self, store: FakeUserStore) -> None:
        user = await store.seed("pilot@example.com")

        with pytest.raises(PasswordUnchangedError):
            await build_service(store).change_password(user.id, PASSWORD, PASSWORD, ADDRESS, NOW)

    async def test_failures_are_limited_like_the_login(self, store: FakeUserStore) -> None:
        user = await store.seed("pilot@example.com")
        service = build_service(store, max_failures=2)
        for _ in range(2):
            with pytest.raises(InvalidCredentialsError):
                await service.change_password(
                    user.id, "wrong password!", NEW_PASSWORD, ADDRESS, NOW
                )

        with pytest.raises(TooManyAttemptsError):
            await service.change_password(user.id, PASSWORD, NEW_PASSWORD, ADDRESS, NOW)

    async def test_an_unknown_account_is_refused(self, store: FakeUserStore) -> None:
        with pytest.raises(InvalidCredentialsError):
            await build_service(store).change_password(404, PASSWORD, NEW_PASSWORD, ADDRESS, NOW)


class TestDeleteAccount:
    async def test_it_anonymises_the_account_after_the_password(self, store: FakeUserStore) -> None:
        user = await store.seed("pilot@example.com")
        service = build_service(store)
        await service.login("pilot@example.com", PASSWORD, ADDRESS, NOW)

        await service.delete_account(user.id, PASSWORD, ADDRESS, NOW)

        assert user.email == f"anonyme-{user.public_id}@aerosafe.invalid"
        assert user.password_hash is None
        assert user.is_active is False
        assert user.anonymised_at == NOW
        assert store.tokens[0].revoked_at == NOW
        assert store.audit == [(user.id, "update", None, {"anonymised": True}, user.id)]

    async def test_a_wrong_password_deletes_nothing(self, store: FakeUserStore) -> None:
        user = await store.seed("pilot@example.com")

        with pytest.raises(InvalidCredentialsError):
            await build_service(store).delete_account(user.id, "wrong password!", ADDRESS, NOW)

        assert user.anonymised_at is None
        assert user.is_active is True

    async def test_failures_are_limited_like_the_login(self, store: FakeUserStore) -> None:
        user = await store.seed("pilot@example.com")
        service = build_service(store, max_failures=1)
        with pytest.raises(InvalidCredentialsError):
            await service.delete_account(user.id, "wrong password!", ADDRESS, NOW)

        with pytest.raises(TooManyAttemptsError):
            await service.delete_account(user.id, PASSWORD, ADDRESS, NOW)

    async def test_the_last_active_supervisor_cannot_delete_their_account(
        self, store: FakeUserStore
    ) -> None:
        user = await store.seed("boss@example.com", RoleCode.SUPERVISOR)

        with pytest.raises(LastSupervisorError):
            await build_service(store).delete_account(user.id, PASSWORD, ADDRESS, NOW)

        assert user.anonymised_at is None

    async def test_a_supervisor_with_a_colleague_can_delete_their_account(
        self, store: FakeUserStore
    ) -> None:
        user = await store.seed("boss@example.com", RoleCode.SUPERVISOR)
        await store.seed("colleague@example.com", RoleCode.SUPERVISOR)

        await build_service(store).delete_account(user.id, PASSWORD, ADDRESS, NOW)

        assert user.anonymised_at == NOW
