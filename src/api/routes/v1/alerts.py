from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import AwareDatetime
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import CurrentUser, RoleCode, require_role
from schemas.alert import AlertOut, AlertPage, AlertStatisticsOut
from services.alerts.service import (
    AlertAlreadyProcessed,
    AlertFilters,
    AlertNotFound,
    AlertService,
    AlertSort,
    AlertStatus,
)
from services.replay.dependencies import Scope

router = APIRouter(prefix="/alerts", tags=["alerts"])

MAX_RESULTS = 200
# Paging uses OFFSET, which reads and drops every skipped row: the bound keeps that cost
# small on ALERTE, which only grows (conventions SQL-02). 10 000 alerts are 50 pages of 200.
MAX_OFFSET = 10_000
DEFAULT_STATISTICS_PERIOD = timedelta(hours=24)


def get_alert_service(session: Annotated[AsyncSession, Depends(get_db)]) -> AlertService:
    return AlertService(session)


Service = Annotated[AlertService, Depends(get_alert_service)]
# Alert supervision is the Supervisor's job (UC-04).
Supervisor = Annotated[CurrentUser, Depends(require_role(RoleCode.SUPERVISOR))]


def invalid(error: ValueError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error))


@router.get("", summary="List alerts")
async def list_alerts(
    service: Service,
    _supervisor: Supervisor,
    scope: Scope,
    rule: Annotated[
        str | None, Query(min_length=1, max_length=20, description="Code of the rule, e.g. R1")
    ] = None,
    alert_status: Annotated[
        AlertStatus | None,
        Query(
            alias="status",
            description="`active`: the situation lasts; `unprocessed` or `processed`",
        ),
    ] = None,
    criticality: Annotated[
        str | None, Query(pattern="^(LOW|MEDIUM|HIGH)$", description="Criticality level")
    ] = None,
    icao24: Annotated[
        str | None,
        Query(pattern="^[0-9a-fA-F]{1,6}$", description="Start of the ICAO24 address"),
    ] = None,
    start: Annotated[
        AwareDatetime | None, Query(description="Triggered at or after, with a time zone")
    ] = None,
    end: Annotated[
        AwareDatetime | None, Query(description="Triggered at or before, with a time zone")
    ] = None,
    sort: Annotated[AlertSort, Query(description="Sort key")] = AlertSort.TRIGGERED_AT,
    order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
    limit: Annotated[int, Query(ge=1, le=MAX_RESULTS)] = 50,
    offset: Annotated[int, Query(ge=0, le=MAX_OFFSET)] = 0,
) -> AlertPage:
    """Alerts matching every given criterion, sorted, one page at a time (BF-12, UC-04).

    With `source=replay`, the alerts of the replayed traffic triggered up to the simulated
    instant."""
    try:
        filters = AlertFilters(
            rule_code=rule,
            status=alert_status,
            criticality=criticality,
            icao24=icao24,
            start=start,
            end=end,
            sort=sort,
            descending=order == "desc",
            limit=limit,
            offset=offset,
            mode=scope.mode,
            at=scope.at,
        )
    except ValueError as error:
        raise invalid(error) from error
    if scope.nothing_to_show:
        return AlertPage(items=[], total=0)
    return await service.search(filters)


@router.get("/statistics", summary="Count alerts per rule over a period")
async def alert_statistics(
    service: Service,
    _supervisor: Supervisor,
    scope: Scope,
    start: Annotated[
        AwareDatetime | None,
        Query(description="With a time zone. Default: 24 hours before end"),
    ] = None,
    end: Annotated[
        AwareDatetime | None,
        Query(description="With a time zone. Default: now, or the simulated instant of a replay"),
    ] = None,
) -> AlertStatisticsOut:
    """Number of alerts triggered in the period, in total and per rule (team decision A-04)."""
    # A replay that never started has no instant: its period is empty, whatever the clock.
    end = end or scope.at or datetime.now(UTC)
    start = start or end - DEFAULT_STATISTICS_PERIOD
    if start > end:
        raise invalid(ValueError("The start of the period must not be after its end"))
    if scope.nothing_to_show:
        return AlertStatisticsOut(start=start, end=end, total=0, per_rule={})
    statistics = await service.statistics(start, end, scope.mode)
    return AlertStatisticsOut(
        start=start, end=end, total=statistics.total, per_rule=statistics.per_rule
    )


@router.get("/{alert_id}", summary="Get the details of an alert")
async def get_alert(alert_id: str, service: Service, _supervisor: Supervisor) -> AlertOut:
    """Aircraft, rule, time, observed value, threshold and message of one alert (BF-12)."""
    alert = await service.get(alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.post("/{alert_id}/process", summary="Mark an alert as processed")
async def process_alert(alert_id: str, service: Service, supervisor: Supervisor) -> AlertOut:
    """Record the Supervisor and the time of processing (UC-04). An alert is processed once."""
    try:
        return await service.mark_processed(alert_id, supervisor.id)
    except AlertNotFound as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        ) from error
    except AlertAlreadyProcessed as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Alert already processed"
        ) from error
