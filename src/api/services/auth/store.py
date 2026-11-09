from datetime import datetime
from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from core.database import get_db
from core.repository import Repository
from models import RefreshToken, Role, User


class UserStore:
    """Database access of the auth work package. The service holds the logic."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._users = Repository(session, User)
        self._tokens = Repository(session, RefreshToken)

    async def get_by_email(self, email: str) -> User | None:
        statement = self._users.select().options(joinedload(User.role)).where(User.email == email)
        return await self._session.scalar(statement)

    async def get_by_public_id(self, public_id: str) -> User | None:
        statement = (
            self._users.select().options(joinedload(User.role)).where(User.public_id == public_id)
        )
        return await self._session.scalar(statement)

    async def get_role(self, code: str) -> Role:
        role = await self._session.scalar(select(Role).where(Role.code == code))
        if role is None:
            raise LookupError(f"Role {code} is missing from R_ROLE")
        return role

    async def add_user(self, email: str, password_hash: str, role: Role) -> User:
        # is_active is set here: its server default would not be loaded after the flush.
        user = User(
            email=email, password_hash=password_hash, role_id=role.id, role=role, is_active=True
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def add_refresh_token(self, user: User, token_hash: str, expires_at: datetime) -> None:
        self._session.add(
            RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
        )
        await self._session.flush()

    async def get_refresh_token(self, token_hash: str) -> RefreshToken | None:
        statement = self._tokens.select().where(RefreshToken.token_hash == token_hash)
        return await self._session.scalar(statement)

    async def get_user(self, user_id: int) -> User | None:
        statement = self._users.select().options(joinedload(User.role)).where(User.id == user_id)
        return await self._session.scalar(statement)

    async def commit(self) -> None:
        await self._session.commit()

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
