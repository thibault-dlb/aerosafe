from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import CurrentUser, get_current_user
from routes.v1.collection import SchedulerDep
from schemas.dashboard import DashboardOut, DashboardStatisticsOut, StatisticsPeriod
from services.alerts.service import AlertService
from services.collection.run_repository import get_state_store
from services.collection.run_state import CollectionStateStore
from services.dashboard.service import DashboardService
from services.replay.dependencies import Scope

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Every account reads the dashboard; the actions behind it (processing an alert, pausing the
# collection) stay the Supervisor's, on their own routes.
Account = Annotated[CurrentUser, Depends(get_current_user)]


def get_dashboard_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    store: Annotated[CollectionStateStore, Depends(get_state_store)],
) -> DashboardService:
    return DashboardService(AlertService(session), store)


Service = Annotated[DashboardService, Depends(get_dashboard_service)]


@router.get("", summary="Figures, active alerts and collection state")
async def get_dashboard(
    _account: Account, service: Service, scope: Scope, scheduler: SchedulerDep
) -> DashboardOut:
    """What the dashboard shows. With `source=replay`, the alerts of the replayed traffic up to
    the simulated instant; the collection state is the real one in both modes."""
    if scope.nothing_to_show:
        return DashboardService.empty(await service.collection(scheduler.enabled, scheduler.busy))
    return await service.overview(
        scope.mode,
        scope.at,
        collection_enabled=scheduler.enabled,
        collection_running=scheduler.busy,
    )


@router.get("/statistics", summary="Alerts per hour or per day, per rule")
async def get_statistics(
    _account: Account,
    service: Service,
    scope: Scope,
    period: Annotated[
        StatisticsPeriod, Query(description="`24h` (per hour), `7d` or `30d` (per day)")
    ] = StatisticsPeriod.DAY,
) -> DashboardStatisticsOut:
    """The chart of alerts: every slice of the period, the empty ones included."""
    if scope.nothing_to_show:
        return await service.empty_statistics(period)
    return await service.statistics(period, scope.mode, scope.at)
