from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.logger import get_logger
from core.security import CurrentUser, RoleCode, get_current_user, require_role
from schemas.replay import ReplaySpeedIn, ReplayStartIn, ReplayStatusOut
from services.replay import (
    InvalidSpeed,
    ReplayOutOfBounds,
    ReplayStatus,
    ReplayUnavailable,
)
from services.replay.dependencies import ReplayServiceDep

logger = get_logger()

router = APIRouter(prefix="/replay", tags=["replay"])

# Every authenticated user can read the clock; only a Supervisor drives it.
Caller = Annotated[CurrentUser, Depends(get_current_user)]
Supervisor = Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))]


def to_out(replay_status: ReplayStatus) -> ReplayStatusOut:
    return ReplayStatusOut.model_validate(replay_status)


def conflict() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, "No replay is available or started")


@router.get("", summary="Read the replay clock")
async def get_replay(_caller: Caller, service: ReplayServiceDep) -> ReplayStatusOut:
    """The period of the replayed data and the simulated instant, shared by every user."""
    return to_out(await service.status())


@router.post("/start", summary="Start the replay at an instant")
async def start_replay(
    body: ReplayStartIn, user: Supervisor, service: ReplayServiceDep
) -> ReplayStatusOut:
    """Start from `at`, even when a replay is running: the alerts of the earlier run that are
    dated `at` or later are removed. Every user sees the same instant."""
    try:
        result = await service.start(body.at, body.speed, user.id)
    except ReplayUnavailable as error:
        raise conflict() from error
    except (ReplayOutOfBounds, InvalidSpeed) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    logger.info("Replay started at {} (x{}) by user {}", body.at, body.speed, user.public_id)
    return to_out(result)


@router.post("/pause", summary="Pause the replay")
async def pause_replay(user: Supervisor, service: ReplayServiceDep) -> ReplayStatusOut:
    try:
        result = await service.pause(user.id)
    except ReplayUnavailable as error:
        raise conflict() from error
    logger.info("Replay paused by user {}", user.public_id)
    return to_out(result)


@router.post("/resume", summary="Resume the replay")
async def resume_replay(user: Supervisor, service: ReplayServiceDep) -> ReplayStatusOut:
    try:
        result = await service.resume(user.id)
    except ReplayUnavailable as error:
        raise conflict() from error
    logger.info("Replay resumed by user {}", user.public_id)
    return to_out(result)


@router.post("/speed", summary="Change the speed of the replay")
async def set_replay_speed(
    body: ReplaySpeedIn, user: Supervisor, service: ReplayServiceDep
) -> ReplayStatusOut:
    try:
        result = await service.set_speed(body.speed, user.id)
    except ReplayUnavailable as error:
        raise conflict() from error
    except InvalidSpeed as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    logger.info("Replay speed set to x{} by user {}", body.speed, user.public_id)
    return to_out(result)
