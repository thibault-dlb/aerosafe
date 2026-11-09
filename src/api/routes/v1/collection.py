from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.logger import get_logger
from core.security import CurrentUser, RoleCode, require_role
from schemas.collection import CollectionRunOut, CollectionStatusOut
from services.collection.run_repository import get_state_store
from services.collection.run_state import CollectionStateStore
from services.collection.scheduler import (
    CollectionBusy,
    CollectionDisabled,
    CollectionRateLimited,
    Scheduler,
)

logger = get_logger()

router = APIRouter(prefix="/collection", tags=["collection"])

Supervisor = Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))]
StateStore = Annotated[CollectionStateStore, Depends(get_state_store)]


def get_scheduler() -> Scheduler:
    """The scheduler started by the application; a stopped one when there is none."""
    return Scheduler.current() or Scheduler()


SchedulerDep = Annotated[Scheduler, Depends(get_scheduler)]


async def _status(scheduler: Scheduler, store: CollectionStateStore) -> CollectionStatusOut:
    settings = scheduler.settings
    profile = settings.profile
    pause = await store.pause_state()
    last_runs = await store.runs(limit=1)
    last_success = await store.last_success()
    return CollectionStatusOut(
        enabled=scheduler.enabled,
        paused=pause.paused,
        paused_at=pause.changed_at if pause.paused else None,
        running=scheduler.busy,
        profile=profile.code,
        period_seconds=profile.period_seconds,
        credits_per_day=profile.credits_per_day,
        daily_quota=settings.daily_quota,
        authenticated=settings.has_credentials,
        rate_limited_until=scheduler.rate_limited_until,
        last_run=CollectionRunOut.model_validate(last_runs[0]) if last_runs else None,
        last_success=CollectionRunOut.model_validate(last_success) if last_success else None,
    )


@router.get("/status")
async def get_status(
    _user: Supervisor, scheduler: SchedulerDep, store: StateStore
) -> CollectionStatusOut:
    """State of the OpenSky collection: profile, credits, last runs, pause."""
    return await _status(scheduler, store)


@router.get("/runs")
async def list_runs(
    _user: Supervisor,
    store: StateStore,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    before: Annotated[datetime | None, Query()] = None,
) -> list[CollectionRunOut]:
    """Latest collection runs, newest first; `before` is the `started_at` of the last one seen."""
    return [CollectionRunOut.model_validate(run) for run in await store.runs(limit, before)]


@router.post("/run")
async def run_now(_user: Supervisor, scheduler: SchedulerDep) -> CollectionRunOut:
    """Run one collection now, even when paused. It uses OpenSky credits."""
    try:
        result = await scheduler.run_now()
    except CollectionDisabled as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Collection is disabled on this instance"
        ) from error
    except CollectionBusy as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "A collection is already running") from error
    except CollectionRateLimited as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
    return CollectionRunOut.model_validate(result)


async def _set_paused(
    paused: bool, user: CurrentUser, scheduler: Scheduler, store: CollectionStateStore
) -> CollectionStatusOut:
    await store.set_paused(paused, datetime.now(UTC), user.id)
    logger.info("Collection {} by user {}", "paused" if paused else "resumed", user.public_id)
    return await _status(scheduler, store)


@router.post("/pause")
async def pause(
    user: Supervisor, scheduler: SchedulerDep, store: StateStore
) -> CollectionStatusOut:
    """Suspend the periodic collection without stopping the API."""
    return await _set_paused(True, user, scheduler, store)


@router.post("/resume")
async def resume(
    user: Supervisor, scheduler: SchedulerDep, store: StateStore
) -> CollectionStatusOut:
    """Resume the periodic collection."""
    return await _set_paused(False, user, scheduler, store)
