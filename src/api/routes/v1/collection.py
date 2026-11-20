from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.data_mode import DataMode
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


def get_live_source(
    source: Annotated[
        Literal["opensky", "adsbfi"],
        Query(description="The live collection: `opensky` (default) or `adsbfi`"),
    ] = "opensky",
) -> DataMode:
    return DataMode(source)


LiveSourceDep = Annotated[DataMode, Depends(get_live_source)]


async def _status(
    scheduler: Scheduler, store: CollectionStateStore, source: DataMode
) -> CollectionStatusOut:
    settings = scheduler.settings
    profile = scheduler.profile(source)
    opensky = source is DataMode.OPENSKY
    pause = await store.pause_state(source)
    last_runs = await store.runs(limit=1, source=source)
    last_success = await store.last_success(source)
    return CollectionStatusOut(
        source=source.value,
        enabled=scheduler.is_enabled(source),
        paused=pause.paused,
        paused_at=pause.changed_at if pause.paused else None,
        running=scheduler.is_busy(source),
        profile=profile.code,
        period_seconds=profile.period_seconds,
        credits_per_day=profile.credits_per_day,
        # adsb.fi has no account and no daily credits.
        daily_quota=settings.daily_quota if opensky else None,
        authenticated=settings.has_credentials if opensky else None,
        rate_limited_until=scheduler.rate_limited_until(source),
        last_run=CollectionRunOut.model_validate(last_runs[0]) if last_runs else None,
        last_success=CollectionRunOut.model_validate(last_success) if last_success else None,
    )


@router.get("/status")
async def get_status(
    _user: Supervisor, scheduler: SchedulerDep, store: StateStore, source: LiveSourceDep
) -> CollectionStatusOut:
    """State of the collection of a live source: profile, credits, last runs, pause."""
    return await _status(scheduler, store, source)


@router.get("/runs")
async def list_runs(
    _user: Supervisor,
    store: StateStore,
    source: LiveSourceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    before: Annotated[datetime | None, Query()] = None,
) -> list[CollectionRunOut]:
    """Latest runs of a source, newest first; `before` is the `started_at` of the last one
    seen."""
    runs = await store.runs(limit, before, source)
    return [CollectionRunOut.model_validate(run) for run in runs]


@router.post("/run")
async def run_now(
    _user: Supervisor, scheduler: SchedulerDep, source: LiveSourceDep
) -> CollectionRunOut:
    """Run one collection of the source now, even when paused. With OpenSky it uses credits."""
    try:
        result = await scheduler.run_now(source)
    except CollectionDisabled as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"The {source.label} collection is disabled on this instance"
        ) from error
    except CollectionBusy as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A {source.label} collection is already running"
        ) from error
    except CollectionRateLimited as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
    return CollectionRunOut.model_validate(result)


async def _set_paused(
    paused: bool,
    user: CurrentUser,
    scheduler: Scheduler,
    store: CollectionStateStore,
    source: DataMode,
) -> CollectionStatusOut:
    await store.set_paused(paused, datetime.now(UTC), user.id, source)
    logger.info(
        "{} collection {} by user {}",
        source.label,
        "paused" if paused else "resumed",
        user.public_id,
    )
    return await _status(scheduler, store, source)


@router.post("/pause")
async def pause(
    user: Supervisor, scheduler: SchedulerDep, store: StateStore, source: LiveSourceDep
) -> CollectionStatusOut:
    """Suspend the periodic collection of a source without stopping the API."""
    return await _set_paused(True, user, scheduler, store, source)


@router.post("/resume")
async def resume(
    user: Supervisor, scheduler: SchedulerDep, store: StateStore, source: LiveSourceDep
) -> CollectionStatusOut:
    """Resume the periodic collection of a source."""
    return await _set_paused(False, user, scheduler, store, source)
