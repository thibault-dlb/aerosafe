import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt

from config.auth import AuthSettings

ALGORITHM = "HS256"
# HS256 needs a key at least as long as its 256-bit output (RFC 7518 §3.2).
MIN_SECRET_LENGTH = 32
# The value of .env.example: long enough, but public.
SECRET_PLACEHOLDER = "changeme"


class InvalidTokenError(Exception):
    """The access token is missing a claim, badly signed or expired."""


@dataclass(frozen=True)
class AccessClaims:
    public_id: str
    role: str


class AccessTokenCodec:
    """Signs and checks the short-lived access token (JWT)."""

    def __init__(self, settings: AuthSettings) -> None:
        self.check_secret(settings.AUTH_JWT_SECRET)
        self._secret = settings.AUTH_JWT_SECRET
        self.lifetime = timedelta(minutes=settings.AUTH_ACCESS_TOKEN_MINUTES)

    @staticmethod
    def check_secret(secret: str) -> None:
        """Refuse a key too short for HS256, or one that still holds the .env.example value."""
        if len(secret) < MIN_SECRET_LENGTH:
            raise RuntimeError(f"AUTH_JWT_SECRET must hold at least {MIN_SECRET_LENGTH} characters")
        if SECRET_PLACEHOLDER in secret.lower():
            raise RuntimeError(
                "AUTH_JWT_SECRET still holds the .env.example placeholder; generate a random one"
            )

    def encode(self, claims: AccessClaims, now: datetime) -> str:
        payload = {
            "sub": claims.public_id,
            "role": claims.role,
            "iat": now,
            "exp": now + self.lifetime,
        }
        return jwt.encode(payload, self._secret, algorithm=ALGORITHM)

    def decode(self, token: str) -> AccessClaims:
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=[ALGORITHM],
                options={"require": ["sub", "role", "iat", "exp"]},
            )
        except jwt.PyJWTError as error:
            raise InvalidTokenError from error
        return AccessClaims(public_id=payload["sub"], role=payload["role"])


class RefreshTokens:
    """Opaque refresh tokens: the client keeps the value, the database keeps its hash."""

    @staticmethod
    def generate() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def hash(token: str) -> str:
        # A plain SHA-256 is enough: the token is random, so there is nothing to brute-force.
        return hashlib.sha256(token.encode()).hexdigest()
