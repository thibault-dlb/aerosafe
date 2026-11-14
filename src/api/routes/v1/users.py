from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from core.security import CurrentUser, RoleCode, get_current_account, require_role
from models import User
from routes.v1.auth import clear_cookie, to_user_read
from schemas.user import (
    AccountCreate,
    AccountCreated,
    AccountPage,
    AccountRead,
    AccountUpdate,
    PasswordConfirmation,
    UserRead,
)
from services.auth.service import (
    AuthService,
    EmailTakenError,
    InvalidCredentialsError,
    LastSupervisorError,
    TooManyAttemptsError,
    get_auth_service,
)
from services.auth.store import UserStore, get_user_store
from services.users.service import (
    AnonymisedAccountError,
    OwnAccountError,
    RoleUnavailableError,
    UserNotFoundError,
    UserService,
    get_user_service,
)

router = APIRouter(prefix="/users", tags=["users"])

MAX_RESULTS = 200
# Paging uses OFFSET, which reads and drops every skipped row: the bound keeps that cost small.
MAX_OFFSET = 10_000

Service = Annotated[UserService, Depends(get_user_service)]
# Account management belongs to the Supervisor (UC-11 to UC-13).
Supervisor = Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))]
# The account page stays open while the password is a provisional one.
Caller = Annotated[CurrentUser, Depends(get_current_account)]


def to_account_read(user: User) -> AccountRead:
    return AccountRead(
        id=user.public_id,
        email=user.email,
        role=user.role.code,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        is_anonymised=user.anonymised_at is not None,
        created_at=user.created_at,
    )


def refused(error: Exception) -> HTTPException:
    """The answer to a change the rules of the account list forbid."""
    if isinstance(error, UserNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    if isinstance(error, OwnAccountError):
        return HTTPException(status.HTTP_403_FORBIDDEN, "You cannot change your own account here")
    if isinstance(error, AnonymisedAccountError):
        return HTTPException(status.HTTP_409_CONFLICT, "The account is anonymised")
    if isinstance(error, LastSupervisorError):
        return HTTPException(status.HTTP_409_CONFLICT, "The last active Supervisor must stay")
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The role is not available")


@router.get("", summary="List the accounts")
async def list_accounts(
    service: Service,
    _supervisor: Supervisor,
    search: Annotated[
        str | None, Query(min_length=1, max_length=254, description="Part of the e-mail")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_RESULTS)] = 50,
    offset: Annotated[int, Query(ge=0, le=MAX_OFFSET)] = 0,
) -> AccountPage:
    """The accounts, oldest first, anonymised ones included (UC-11)."""
    users, total = await service.search(search, limit, offset)
    return AccountPage(items=[to_account_read(user) for user in users], total=total)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create an account")
async def create_account(
    body: AccountCreate, service: Service, supervisor: Supervisor
) -> AccountCreated:
    """Create an account with a generated password, returned this once (UC-12).

    The owner must choose their own password at the first login."""
    try:
        user, password = await service.create(body.email, body.role, supervisor)
    except EmailTakenError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from error
    except RoleUnavailableError as error:
        raise refused(error) from error
    return AccountCreated(account=to_account_read(user), temporary_password=password)


@router.get("/me", summary="Read the account of the caller")
async def read_me(caller: Caller, store: Annotated[UserStore, Depends(get_user_store)]) -> UserRead:
    user = await store.get_user(caller.id)
    assert user is not None  # the caller was read from the database a moment ago
    return to_user_read(user)


@router.post(
    "/me/anonymise",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete the account of the caller",
)
async def delete_me(
    body: PasswordConfirmation,
    request: Request,
    response: Response,
    caller: Caller,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    """Anonymise the account of the caller after their password (RGPD erasure).

    The e-mail and the password are erased, the sessions end, and the history stays."""
    address = request.client.host if request.client else "unknown"
    try:
        await auth.delete_account(caller.id, body.password, address, datetime.now(UTC))
    except TooManyAttemptsError as error:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts, try again later"
        ) from error
    except InvalidCredentialsError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is incorrect") from error
    except LastSupervisorError as error:
        raise refused(error) from error
    clear_cookie(response)


@router.patch("/{account_id}", summary="Change the role or the state of an account")
async def update_account(
    account_id: str, body: AccountUpdate, service: Service, supervisor: Supervisor
) -> AccountRead:
    """Change the role, deactivate or reactivate an account (UC-13).

    A deactivated account loses its sessions at once. Nobody changes their own account here,
    and the last active Supervisor stays."""
    try:
        user = await service.update(
            account_id, body.role, body.is_active, supervisor, datetime.now(UTC)
        )
    except (
        UserNotFoundError,
        OwnAccountError,
        AnonymisedAccountError,
        LastSupervisorError,
        RoleUnavailableError,
    ) as error:
        raise refused(error) from error
    return to_account_read(user)


@router.post("/{account_id}/anonymise", summary="Anonymise an account")
async def anonymise_account(
    account_id: str, service: Service, supervisor: Supervisor
) -> AccountRead:
    """Erase what identifies an account and end its sessions; the history stays (RGPD)."""
    try:
        user = await service.anonymise(account_id, supervisor, datetime.now(UTC))
    except (
        UserNotFoundError,
        OwnAccountError,
        AnonymisedAccountError,
        LastSupervisorError,
    ) as error:
        raise refused(error) from error
    return to_account_read(user)
