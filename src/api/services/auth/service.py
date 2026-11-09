from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends
from sqlalchemy.exc import IntegrityError

from config.auth import settings as auth_settings
from core.security import RoleCode
from models import User
from services.auth.store import UserStore, get_user_store
from services.auth.throttle import LoginThrottle
from services.auth.tokens import AccessClaims, AccessTokenCodec, RefreshTokens


class EmailTakenError(Exception):
    """An account already uses this e-mail."""


class InvalidCredentialsError(Exception):
    """Wrong e-mail or password, or an account that cannot log in. Callers never learn which."""


class TooManyAttemptsError(Exception):
    """Too many failed logins for this e-mail from this address."""


class InvalidRefreshTokenError(Exception):
    """Unknown, revoked or expired refresh token."""


@dataclass(frozen=True)
class AuthSession:
    access_token: str
    refresh_token: str
    user: User


hasher = PasswordHasher()  # argon2id with the library's OWASP-aligned defaults


@cache
def _dummy_hash() -> str:
    return hasher.hash("timing-equaliser")


class AuthService:
    """Sign-up, login, refresh and logout (BF-01)."""

    def __init__(
        self,
        store: UserStore,
        codec: AccessTokenCodec,
        throttle: LoginThrottle,
        refresh_lifetime: timedelta,
    ) -> None:
        self._store = store
        self._codec = codec
        self._throttle = throttle
        self._refresh_lifetime = refresh_lifetime

    async def sign_up(self, email: str, password: str) -> User:
        role = await self._store.get_role(RoleCode.USER)
        try:
            user = await self._store.add_user(email, hasher.hash(password), role)
        except IntegrityError as error:
            raise EmailTakenError from error
        await self._store.commit()
        return user

    async def login(self, email: str, password: str, address: str, now: datetime) -> AuthSession:
        if self._throttle.is_blocked(email, address, now):
            raise TooManyAttemptsError
        user = await self._store.get_by_email(email)
        if not self._password_matches(user, password):
            self._throttle.record_failure(email, address, now)
            raise InvalidCredentialsError
        self._throttle.reset(email, address)
        return await self._open_session(user, now)

    async def refresh(self, refresh_token: str, now: datetime) -> AuthSession:
        # Rotation: each refresh token is used once, even by two requests sent together.
        user_id = await self._store.revoke_refresh_token(RefreshTokens.hash(refresh_token), now)
        if user_id is None:
            raise InvalidRefreshTokenError
        user = await self._store.get_user(user_id)
        if not UserStore.can_log_in(user):
            raise InvalidRefreshTokenError
        return await self._open_session(user, now)

    async def logout(self, refresh_token: str, now: datetime) -> None:
        if await self._store.revoke_refresh_token(RefreshTokens.hash(refresh_token), now):
            await self._store.commit()

    @property
    def access_lifetime(self) -> timedelta:
        return self._codec.lifetime

    @property
    def refresh_lifetime(self) -> timedelta:
        return self._refresh_lifetime

    @staticmethod
    def _password_matches(user: User | None, password: str) -> bool:
        if not UserStore.can_log_in(user):
            # Hash anyway, so an unknown e-mail takes as long as a wrong password.
            _verify(_dummy_hash(), password)
            return False
        return _verify(user.password_hash, password)

    async def _open_session(self, user: User, now: datetime) -> AuthSession:
        refresh_token = RefreshTokens.generate()
        await self._store.add_refresh_token(
            user, RefreshTokens.hash(refresh_token), now + self._refresh_lifetime
        )
        await self._store.commit()
        access_token = self._codec.encode(AccessClaims(user.public_id, user.role.code), now)
        return AuthSession(access_token, refresh_token, user)


def _verify(password_hash: str, password: str) -> bool:
    try:
        return hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


throttle = LoginThrottle(
    auth_settings.AUTH_LOGIN_MAX_FAILURES,
    timedelta(minutes=auth_settings.AUTH_LOGIN_LOCK_MINUTES),
)


def get_auth_service(store: Annotated[UserStore, Depends(get_user_store)]) -> AuthService:
    return AuthService(
        store,
        AccessTokenCodec(auth_settings),
        throttle,
        timedelta(days=auth_settings.AUTH_REFRESH_TOKEN_DAYS),
    )
