from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.auth import settings as auth_settings
from services.auth.store import UserStore, get_user_store
from services.auth.tokens import AccessTokenCodec, InvalidTokenError

bearer_scheme = HTTPBearer(auto_error=False)

PASSWORD_CHANGE_REQUIRED = "Password change required"


class RoleCode:
    """Stable codes of the `R_ROLE` reference table."""

    USER = "USER"
    SUPERVISOR = "SUPERVISOR"


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated caller.

    `id` is the internal key, for foreign keys only. `public_id` is the ULID: the only one
    that may appear in a token, a URL or a response.
    """

    id: int
    public_id: str
    role: str
    # An account created by a Supervisor must first replace its provisional password.
    must_change_password: bool = False


async def get_current_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    store: Annotated[UserStore, Depends(get_user_store)],
) -> CurrentUser:
    """Return the caller, or answer 401. A provisional password is not an obstacle here.

    The account is read on every request, so a deactivated or anonymised account loses
    access at once, and the role comes from the database rather than from the token.
    Only the routes that let the owner choose a password use this one: all the others use
    `get_current_user`.
    """
    unauthorised = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorised
    try:
        claims = AccessTokenCodec(auth_settings).decode(credentials.credentials)
    except InvalidTokenError as error:
        raise unauthorised from error
    user = await store.get_by_public_id(claims.public_id)
    if not UserStore.can_log_in(user):
        raise unauthorised
    return CurrentUser(
        id=user.id,
        public_id=user.public_id,
        role=user.role.code,
        must_change_password=user.must_change_password,
    )


async def get_current_user(
    caller: Annotated[CurrentUser, Depends(get_current_account)],
) -> CurrentUser:
    """Return the caller, or answer 401; answer 403 while the password is a provisional one."""
    if caller.must_change_password:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PASSWORD_CHANGE_REQUIRED)
    return caller


def require_role(*roles: str) -> Callable[..., Awaitable[CurrentUser]]:
    """Build a dependency that lets through the given roles and answers 403 to the others."""

    async def check_role(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return check_role
