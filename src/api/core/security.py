from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)


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


async def get_current_user(
    _credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> CurrentUser:
    """Return the caller, or answer 401.

    Frozen signature. The `feat/auth-accounts` work package implements the token check.
    Until then every request is refused, so no endpoint is open by mistake.
    """
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_role(*roles: str) -> Callable[..., Awaitable[CurrentUser]]:
    """Build a dependency that lets through the given roles and answers 403 to the others."""

    async def check_role(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user

    return check_role
