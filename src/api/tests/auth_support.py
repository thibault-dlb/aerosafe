"""In-memory stand-in for `UserStore`, shared by the auth tests (no database needed)."""

from datetime import timedelta
from itertools import count
from unittest.mock import AsyncMock

from sqlalchemy.exc import IntegrityError

from config.auth import AuthSettings
from core.models import new_ulid
from core.security import RoleCode
from models import RefreshToken, Role, User
from services.auth.service import AuthService, hasher
from services.auth.store import UserStore
from services.auth.throttle import LoginThrottle
from services.auth.tokens import AccessTokenCodec

SECRET = "test-secret-with-at-least-32-characters"
SETTINGS = AuthSettings(AUTH_JWT_SECRET=SECRET)
PASSWORD = "correct horse battery"


class FakeUserStore(UserStore):
    def __init__(self) -> None:
        super().__init__(AsyncMock())  # every method is overridden, so the session stays unused
        self.roles = {
            code: Role(id=i, code=code, label=code)
            for i, code in enumerate((RoleCode.USER, RoleCode.SUPERVISOR), start=1)
        }
        self.users: list[User] = []
        self.tokens: list[RefreshToken] = []
        self.commits = 0
        self._ids = count(1)

    async def get_by_email(self, email: str) -> User | None:
        return next((user for user in self.users if user.email == email), None)

    async def get_by_public_id(self, public_id: str) -> User | None:
        return next((user for user in self.users if user.public_id == public_id), None)

    async def get_role(self, code: str) -> Role:
        return self.roles[code]

    async def add_user(self, email: str, password_hash: str, role: Role) -> User:
        if await self.get_by_email(email):
            raise IntegrityError("INSERT", {}, Exception("duplicate e-mail"))
        user = User(
            id=next(self._ids),
            public_id=new_ulid(),
            email=email,
            password_hash=password_hash,
            role_id=role.id,
            role=role,
            is_active=True,
        )
        self.users.append(user)
        return user

    async def add_refresh_token(self, user: User, token_hash: str, expires_at) -> None:
        self.tokens.append(
            RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
        )

    async def get_refresh_token(self, token_hash: str) -> RefreshToken | None:
        return next((token for token in self.tokens if token.token_hash == token_hash), None)

    async def get_user(self, user_id: int) -> User | None:
        return next((user for user in self.users if user.id == user_id), None)

    async def commit(self) -> None:
        self.commits += 1

    async def seed(self, email: str, role: str = RoleCode.USER) -> User:
        return await self.add_user(email, hasher.hash(PASSWORD), self.roles[role])


def build_service(store: FakeUserStore, max_failures: int = 5) -> AuthService:
    return AuthService(
        store,
        AccessTokenCodec(SETTINGS),
        LoginThrottle(max_failures, timedelta(minutes=15)),
        timedelta(days=7),
    )
