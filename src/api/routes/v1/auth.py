from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status

from config.auth import settings as auth_settings
from models import User
from schemas.auth import LoginRequest, SignUpRequest, TokenResponse
from schemas.user import UserRead
from services.auth.service import (
    AuthService,
    AuthSession,
    EmailTakenError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    TooManyAttemptsError,
    get_auth_service,
)

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
# The browser only sends the refresh token to the auth endpoints.
REFRESH_COOKIE_PATH = "/api/v1/auth"

Service = Annotated[AuthService, Depends(get_auth_service)]
RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def to_user_read(user: User) -> UserRead:
    return UserRead(
        id=user.public_id, email=user.email, role=user.role.code, is_active=user.is_active
    )


def open_session(response: Response, service: AuthService, session: AuthSession) -> TokenResponse:
    response.set_cookie(
        REFRESH_COOKIE,
        session.refresh_token,
        max_age=int(service.refresh_lifetime.total_seconds()),
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=auth_settings.AUTH_COOKIE_SECURE,
        samesite="strict",
    )
    return TokenResponse(
        access_token=session.access_token,
        expires_in=int(service.access_lifetime.total_seconds()),
        user=to_user_read(session.user),
    )


def clear_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=auth_settings.AUTH_COOKIE_SECURE,
        samesite="strict",
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def sign_up(body: SignUpRequest, service: Service) -> UserRead:
    """Create an account with the User role (UC-09)."""
    try:
        user = await service.sign_up(body.email, body.password)
    except EmailTakenError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from error
    return to_user_read(user)


@router.post("/login")
async def login(
    body: LoginRequest, request: Request, response: Response, service: Service
) -> TokenResponse:
    """Check the password, return an access token and set the refresh cookie (UC-10)."""
    address = request.client.host if request.client else "unknown"
    try:
        session = await service.login(body.email, body.password, address, datetime.now(UTC))
    except TooManyAttemptsError as error:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed logins, try again later"
        ) from error
    except InvalidCredentialsError as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password") from error
    return open_session(response, service, session)


@router.post("/refresh")
async def refresh(
    response: Response, service: Service, token: RefreshCookie = None
) -> TokenResponse:
    """Swap the refresh cookie for a new access token and a new refresh cookie."""
    try:
        if token is None:
            raise InvalidRefreshTokenError
        session = await service.refresh(token, datetime.now(UTC))
    except InvalidRefreshTokenError as error:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Session expired",
            headers={"Set-Cookie": _expired_cookie_header()},
        ) from error
    return open_session(response, service, session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, service: Service, token: RefreshCookie = None) -> None:
    """Revoke the refresh token and clear its cookie."""
    if token is not None:
        await service.logout(token, datetime.now(UTC))
    clear_cookie(response)


def _expired_cookie_header() -> str:
    response = Response()
    clear_cookie(response)
    return response.headers["set-cookie"]
