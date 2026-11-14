from datetime import UTC, datetime

import pytest

from core.security import CurrentUser, RoleCode
from models import User
from services.auth.service import EmailTakenError, LastSupervisorError, hasher
from services.users.passwords import TemporaryPassword
from services.users.service import (
    AnonymisedAccountError,
    OwnAccountError,
    RoleUnavailableError,
    UserNotFoundError,
    UserService,
    get_user_service,
)
from tests.auth_support import FakeUserStore

NOW = datetime(2026, 11, 14, 12, tzinfo=UTC)


@pytest.fixture
def store() -> FakeUserStore:
    return FakeUserStore()


@pytest.fixture
def service(store: FakeUserStore) -> UserService:
    return UserService(store)


def caller(user: User) -> CurrentUser:
    return CurrentUser(id=user.id, public_id=user.public_id, role=user.role.code)


async def two_supervisors(store: FakeUserStore) -> tuple[User, User]:
    first = await store.seed("first@example.com", RoleCode.SUPERVISOR)
    second = await store.seed("second@example.com", RoleCode.SUPERVISOR)
    return first, second


class TestTemporaryPassword:
    def test_it_is_four_groups_of_five_unambiguous_characters(self) -> None:
        groups = TemporaryPassword.generate().split("-")

        assert [len(group) for group in groups] == [5, 5, 5, 5]
        assert set("".join(groups)) <= set(TemporaryPassword.ALPHABET)
        assert not set("".join(groups)) & set("01OIL")

    def test_it_is_long_enough_to_be_accepted_as_a_password(self) -> None:
        assert len(TemporaryPassword.generate()) >= 12

    def test_two_are_different(self) -> None:
        assert TemporaryPassword.generate() != TemporaryPassword.generate()


class TestCreate:
    async def test_it_creates_the_account_with_a_provisional_password(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        user, password = await service.create("new@example.com", RoleCode.USER, caller(actor))

        assert user.must_change_password is True
        assert user.role.code == RoleCode.USER
        assert hasher.verify(user.password_hash, password)
        assert user.password_hash != password
        assert store.commits == 1

    async def test_it_is_written_to_the_audit_log_without_the_password_or_the_e_mail(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        user, _ = await service.create("new@example.com", RoleCode.SUPERVISOR, caller(actor))

        assert store.audit == [(user.id, "create", None, {"role": "SUPERVISOR"}, actor.id)]

    async def test_a_taken_e_mail_is_refused(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, other = await two_supervisors(store)

        with pytest.raises(EmailTakenError):
            await service.create(other.email, RoleCode.USER, caller(actor))
        assert store.audit == []

    async def test_a_role_that_is_not_available_is_refused(
        self, store: FakeUserStore, service: UserService, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        actor, _ = await two_supervisors(store)

        async def missing(_code: str):
            raise LookupError("inactive")

        monkeypatch.setattr(store, "get_role", missing)

        with pytest.raises(RoleUnavailableError):
            await service.create("new@example.com", RoleCode.USER, caller(actor))


class TestUpdate:
    async def test_it_changes_the_role_and_audits_it(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")

        user = await service.update(member.public_id, RoleCode.SUPERVISOR, None, caller(actor), NOW)

        assert user.role.code == RoleCode.SUPERVISOR
        assert user.role_id == store.roles[RoleCode.SUPERVISOR].id
        assert store.audit == [
            (
                member.id,
                "update",
                {"role": "USER", "is_active": True},
                {"role": "SUPERVISOR", "is_active": True},
                actor.id,
            )
        ]
        assert store.commits == 1

    async def test_deactivating_ends_the_sessions(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")
        await store.add_refresh_token(member, "hash", NOW)

        user = await service.update(member.public_id, None, False, caller(actor), NOW)

        assert user.is_active is False
        assert store.tokens[0].revoked_at == NOW

    async def test_reactivating_keeps_the_sessions_ended(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")
        member.is_active = False

        user = await service.update(member.public_id, None, True, caller(actor), NOW)

        assert user.is_active is True

    async def test_a_change_that_changes_nothing_is_not_audited(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")

        await service.update(member.public_id, RoleCode.USER, True, caller(actor), NOW)

        assert store.audit == []

    async def test_a_supervisor_cannot_change_their_own_role_or_state(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        with pytest.raises(OwnAccountError):
            await service.update(actor.public_id, RoleCode.USER, None, caller(actor), NOW)
        with pytest.raises(OwnAccountError):
            await service.update(actor.public_id, None, False, caller(actor), NOW)
        assert actor.role.code == RoleCode.SUPERVISOR
        assert actor.is_active is True

    async def test_repeating_the_current_values_on_oneself_is_harmless(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        user = await service.update(actor.public_id, RoleCode.SUPERVISOR, True, caller(actor), NOW)

        assert user is actor

    async def test_the_last_active_supervisor_stays(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor = await store.seed("actor@example.com", RoleCode.SUPERVISOR)
        # A second Supervisor exists but cannot log in, so the actor is alone in charge.
        other = await store.seed("other@example.com", RoleCode.SUPERVISOR)
        actor.is_active = False
        stand_in = CurrentUser(id=99, public_id="01JC0000000000000000000099", role="SUPERVISOR")

        with pytest.raises(LastSupervisorError):
            await service.update(other.public_id, RoleCode.USER, None, stand_in, NOW)
        with pytest.raises(LastSupervisorError):
            await service.update(other.public_id, None, False, stand_in, NOW)
        assert other.role.code == RoleCode.SUPERVISOR
        assert other.is_active is True

    async def test_an_inactive_supervisor_can_be_demoted_freely(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, other = await two_supervisors(store)
        other.is_active = False

        user = await service.update(other.public_id, RoleCode.USER, None, caller(actor), NOW)

        assert user.role.code == RoleCode.USER

    async def test_an_anonymised_account_does_not_change(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")
        member.anonymised_at = NOW

        with pytest.raises(AnonymisedAccountError):
            await service.update(member.public_id, None, True, caller(actor), NOW)

    async def test_an_unknown_account_is_not_found(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        with pytest.raises(UserNotFoundError):
            await service.update("01JC0000000000000000000404", None, True, caller(actor), NOW)


class TestAnonymise:
    async def test_it_erases_what_identifies_the_account_and_ends_its_sessions(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")
        await store.add_refresh_token(member, "hash", NOW)

        user = await service.anonymise(member.public_id, caller(actor), NOW)

        assert user.email == f"anonyme-{member.public_id}@aerosafe.invalid"
        assert user.password_hash is None
        assert user.is_active is False
        assert user.anonymised_at == NOW
        assert store.tokens[0].revoked_at == NOW
        assert store.audit == [(member.id, "update", None, {"anonymised": True}, actor.id)]
        assert store.commits == 1

    async def test_a_supervisor_cannot_anonymise_themselves_here(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        with pytest.raises(OwnAccountError):
            await service.anonymise(actor.public_id, caller(actor), NOW)

    async def test_the_last_active_supervisor_stays(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        other = await store.seed("other@example.com", RoleCode.SUPERVISOR)
        stand_in = CurrentUser(id=99, public_id="01JC0000000000000000000099", role="SUPERVISOR")

        with pytest.raises(LastSupervisorError):
            await service.anonymise(other.public_id, stand_in, NOW)

    async def test_an_account_is_anonymised_once(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)
        member = await store.seed("member@example.com")
        await service.anonymise(member.public_id, caller(actor), NOW)

        with pytest.raises(AnonymisedAccountError):
            await service.anonymise(member.public_id, caller(actor), NOW)

    async def test_an_unknown_account_is_not_found(
        self, store: FakeUserStore, service: UserService
    ) -> None:
        actor, _ = await two_supervisors(store)

        with pytest.raises(UserNotFoundError):
            await service.anonymise("01JC0000000000000000000404", caller(actor), NOW)


async def test_the_search_goes_through_the_store(
    store: FakeUserStore, service: UserService
) -> None:
    await store.seed("alpha@example.com")
    await store.seed("beta@example.com")

    users, total = await service.search("beta", 10, 0)

    assert [user.email for user in users] == ["beta@example.com"]
    assert total == 1


async def test_the_service_is_built_on_the_store(store: FakeUserStore) -> None:
    assert isinstance(get_user_service(store), UserService)
