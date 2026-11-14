import asyncio
from datetime import datetime
from typing import Annotated

from fastapi import Depends
from sqlalchemy.exc import IntegrityError

from core.security import CurrentUser, RoleCode
from models import Role, User
from services.auth.service import EmailTakenError, LastSupervisorError, hasher
from services.auth.store import UserStore, get_user_store
from services.users.passwords import TemporaryPassword


class UserNotFoundError(Exception):
    """No account has this public identifier."""


class OwnAccountError(Exception):
    """A Supervisor tried to change their own role, state or existence from the account list."""


class AnonymisedAccountError(Exception):
    """An anonymised account no longer changes: nobody is behind it."""


class RoleUnavailableError(Exception):
    """The role is missing from `R_ROLE` or no longer active."""


class UserService:
    """Account management by a Supervisor (UC-11 to UC-13).

    A Supervisor lists the accounts, creates one with a provisional password, changes a role,
    deactivates or reactivates it, and anonymises it. Nobody can do any of this to their own
    account from here (they have the account page for that), and the last active Supervisor
    always stays. Each change is written to the audit log; a deactivated or anonymised
    account loses its sessions at once.
    """

    def __init__(self, store: UserStore) -> None:
        self._store = store

    async def search(self, search: str | None, limit: int, offset: int) -> tuple[list[User], int]:
        return await self._store.search_users(search, limit, offset)

    async def create(self, email: str, role_code: str, actor: CurrentUser) -> tuple[User, str]:
        """Create an account with a generated password and return both; the password is not kept."""
        role = await self._role(role_code)
        password = TemporaryPassword.generate()
        try:
            password_hash = await asyncio.to_thread(hasher.hash, password)
            user = await self._store.add_user(email, password_hash, role, temporary_password=True)
        except IntegrityError as error:
            raise EmailTakenError from error
        await self._store.record_audit(user, "create", None, {"role": role.code}, actor.id)
        await self._store.commit()
        return user, password

    async def update(
        self,
        public_id: str,
        role_code: str | None,
        is_active: bool | None,
        actor: CurrentUser,
        now: datetime,
    ) -> User:
        """Change the role and the state of an account; a field left out stays as it is."""
        user = await self._editable(public_id)
        before = {"role": user.role.code, "is_active": user.is_active}
        role_changes = role_code is not None and role_code != user.role.code
        state_changes = is_active is not None and is_active != user.is_active
        if user.public_id == actor.public_id and (role_changes or state_changes):
            raise OwnAccountError
        if role_changes:
            # The role and the state are checked before anything is written.
            if user.role.code == RoleCode.SUPERVISOR:
                await self._keep_a_supervisor(user)
            user.role = await self._role(role_code)
            user.role_id = user.role.id
        if state_changes:
            if not is_active and user.role.code == RoleCode.SUPERVISOR:
                await self._keep_a_supervisor(user)
            user.is_active = is_active
            if not is_active:
                await self._store.revoke_user_tokens(user.id, now)
        after = {"role": user.role.code, "is_active": user.is_active}
        if after != before:
            await self._store.record_audit(user, "update", before, after, actor.id)
        await self._store.commit()
        return user

    async def anonymise(self, public_id: str, actor: CurrentUser, now: datetime) -> User:
        user = await self._editable(public_id)
        if user.public_id == actor.public_id:
            raise OwnAccountError
        if user.role.code == RoleCode.SUPERVISOR:
            await self._keep_a_supervisor(user)
        await self._store.anonymise(user, now, actor.id)
        await self._store.commit()
        return user

    async def _editable(self, public_id: str) -> User:
        user = await self._store.lock_by_public_id(public_id)
        if user is None:
            raise UserNotFoundError(public_id)
        if user.anonymised_at is not None:
            raise AnonymisedAccountError(public_id)
        return user

    async def _keep_a_supervisor(self, leaving: User) -> None:
        """Refuse a change that takes `leaving` away from the active Supervisors, if the last."""
        if not leaving.is_active:
            return
        if await self._store.count_active_in_role(leaving.role) <= 1:
            raise LastSupervisorError

    async def _role(self, code: str) -> Role:
        try:
            return await self._store.get_role(code)
        except LookupError as error:
            raise RoleUnavailableError(code) from error


def get_user_service(store: Annotated[UserStore, Depends(get_user_store)]) -> UserService:
    return UserService(store)
