from datetime import datetime
from typing import Annotated

from fastapi import Depends
from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from core.database import get_db
from core.repository import Repository
from models import AuditAction, AuditLog, RefreshToken, Role, User


class UserStore:
    """Database access of the auth work package. The service holds the logic."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._users = Repository(session, User)

    async def get_by_email(self, email: str) -> User | None:
        return await self._get_user(User.email == email)

    async def get_by_public_id(self, public_id: str) -> User | None:
        return await self._get_user(User.public_id == public_id)

    async def get_role(self, code: str) -> Role:
        # An inactive role can no longer be given to an account.
        statement = select(Role).where(Role.code == code, Role.is_active.is_(True))
        role = await self._session.scalar(statement)
        if role is None:
            raise LookupError(f"Role {code} is missing from R_ROLE or inactive")
        return role

    async def add_user(
        self, email: str, password_hash: str, role: Role, *, temporary_password: bool = False
    ) -> User:
        # The flags are set here: their server defaults would not be loaded after the flush.
        user = User(
            email=email,
            password_hash=password_hash,
            role_id=role.id,
            role=role,
            is_active=True,
            must_change_password=temporary_password,
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def add_refresh_token(self, user: User, token_hash: str, expires_at: datetime) -> None:
        self._session.add(
            RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
        )
        await self._session.flush()

    async def revoke_refresh_token(self, token_hash: str, now: datetime) -> int | None:
        """Revoke a valid refresh token and return its owner's key; None if it was not valid.

        The check and the revocation are one UPDATE. Its row lock serialises two requests with
        the same token: the second one finds the token revoked and gets nothing back.
        """
        statement = (
            update(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
                RefreshToken.deleted_at.is_(None),
            )
            .values(revoked_at=now)
            .returning(RefreshToken.user_id)
        )
        return await self._session.scalar(statement)

    async def revoke_user_tokens(self, user_id: int, now: datetime) -> None:
        """Revoke every valid refresh token of the account: its sessions end at once."""
        statement = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.deleted_at.is_(None),
            )
            .values(revoked_at=now)
        )
        await self._session.execute(statement)

    async def get_user(self, user_id: int) -> User | None:
        return await self._get_user(User.id == user_id)

    async def lock_by_public_id(self, public_id: str) -> User | None:
        """The account, with its row locked until the commit: changes to it are serialised."""
        statement = (
            self._users.select()
            .options(joinedload(User.role))
            .where(User.public_id == public_id)
            .with_for_update(of=User)
            .execution_options(populate_existing=True)
        )
        return await self._session.scalar(statement)

    async def search_users(
        self, search: str | None, limit: int, offset: int
    ) -> tuple[list[User], int]:
        """One page of accounts, oldest first, and how many match, all pages included."""
        criteria: list[ColumnElement[bool]] = []
        if search:
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            criteria.append(User.email.ilike(f"%{escaped}%", escape="\\"))
        statement = (
            self._users.select()
            .options(joinedload(User.role))
            .where(*criteria)
            .order_by(User.created_at, User.id)
            .limit(limit)
            .offset(offset)
        )
        users = list((await self._session.scalars(statement)).all())
        total = await self._session.scalar(
            select(func.count()).select_from(User).where(User.deleted_at.is_(None), *criteria)
        )
        return users, total or 0

    async def count_active_in_role(self, role: Role) -> int:
        """How many accounts of the given role can log in."""
        statement = (
            select(func.count())
            .select_from(User)
            .where(
                User.role_id == role.id,
                User.is_active.is_(True),
                User.anonymised_at.is_(None),
                User.deleted_at.is_(None),
            )
        )
        return await self._session.scalar(statement) or 0

    async def record_audit(
        self,
        user: User,
        action: str,
        old_values: dict[str, object] | None,
        new_values: dict[str, object] | None,
        actor_id: int | None,
    ) -> None:
        """Write an account change to the append-only audit log (never the e-mail or a hash)."""
        action_id = await self._session.scalar(
            select(AuditAction.id).where(AuditAction.code == action)
        )
        self._session.add(
            AuditLog(
                table_name=User.__tablename__,
                record_id=user.id,
                action_id=action_id,
                old_values=old_values,
                new_values=new_values,
                user_id=actor_id,
            )
        )
        await self._session.flush()

    async def anonymise(self, user: User, now: datetime, actor_id: int) -> None:
        """Erase what identifies the account, end its sessions and keep the row (RGPD).

        The e-mail becomes a placeholder built on the public identifier, the password hash
        is dropped and the account can no longer log in. Its history stays: alerts it
        handled, the audit trail.
        """
        user.email = f"anonyme-{user.public_id}@aerosafe.invalid"
        user.password_hash = None
        user.is_active = False
        user.must_change_password = False
        user.anonymised_at = now
        await self._session.flush()
        await self.revoke_user_tokens(user.id, now)
        await self.record_audit(user, "update", None, {"anonymised": True}, actor_id)

    async def commit(self) -> None:
        await self._session.commit()

    async def _get_user(self, criterion: ColumnElement[bool]) -> User | None:
        """The account matching the criterion, with its role; a deleted account is never read."""
        statement = self._users.select().options(joinedload(User.role)).where(criterion)
        return await self._session.scalar(statement)

    @staticmethod
    def can_log_in(user: User | None) -> bool:
        return (
            user is not None
            and user.is_active
            and user.anonymised_at is None
            and user.password_hash is not None
        )


def get_user_store(session: Annotated[AsyncSession, Depends(get_db)]) -> UserStore:
    return UserStore(session)
