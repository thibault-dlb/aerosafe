from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.data_mode import DataMode
from core.database import get_db
from core.security import CurrentUser, get_current_user
from routes.v1.flights import FlightServiceDep
from schemas.aircraft import AircraftSummary, ObservationPoint
from schemas.flight import FlightSummary
from services.aircraft import (
    AircraftSearchCriteria,
    AircraftService,
    BoundingBox,
    ObservationPeriod,
    ObservationReader,
)
from services.preview import LivePreview, PreviewUnavailable, live_preview
from services.replay.dependencies import Scope

router = APIRouter(prefix="/aircraft", tags=["aircraft"])

# The dashboard map draws every aircraft of the area, a few thousand at the busiest hour.
MAX_RESULTS = 2000
MAX_OBSERVATIONS = 5000


def get_aircraft_service(session: Annotated[AsyncSession, Depends(get_db)]) -> AircraftService:
    return AircraftService(session)


def get_observation_reader(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ObservationReader:
    return ObservationReader(session)


def get_live_preview() -> LivePreview:
    """FastAPI dependency, overridden in tests."""
    return live_preview


Service = Annotated[AircraftService, Depends(get_aircraft_service)]
PreviewDep = Annotated[LivePreview, Depends(get_live_preview)]
Reader = Annotated[ObservationReader, Depends(get_observation_reader)]
# Every authenticated user can look up aircraft, whatever the role (UC-01).
Caller = Annotated[CurrentUser, Depends(get_current_user)]


def build_area(
    south: float | None, west: float | None, north: float | None, east: float | None
) -> BoundingBox | None:
    """Build the search area: the four bounds go together or not at all."""
    bounds = (south, west, north, east)
    if all(bound is None for bound in bounds):
        return None
    if any(bound is None for bound in bounds):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="An area needs the four bounds: south, west, north and east",
        )
    try:
        return BoundingBox(south=south, west=west, north=north, east=east)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        ) from error


@router.get("", summary="Search aircraft")
async def search_aircraft(
    service: Service,
    _caller: Caller,
    scope: Scope,
    icao24: Annotated[
        str | None,
        Query(pattern="^[0-9a-fA-F]{1,6}$", description="Start of the ICAO24 address"),
    ] = None,
    registration: Annotated[
        str | None, Query(min_length=1, max_length=20, description="Part of the registration")
    ] = None,
    airline: Annotated[
        str | None,
        Query(min_length=1, max_length=100, description="Part of the airline name or code"),
    ] = None,
    south: Annotated[float | None, Query(ge=-90, le=90)] = None,
    west: Annotated[float | None, Query(ge=-180, le=180)] = None,
    north: Annotated[float | None, Query(ge=-90, le=90)] = None,
    east: Annotated[float | None, Query(ge=-180, le=180)] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_RESULTS)] = 50,
    heard_within_seconds: Annotated[
        int | None,
        Query(
            ge=1,
            le=3_600,
            description="Live only: keep the aircraft heard in this many seconds before now",
        ),
    ] = None,
) -> list[AircraftSummary]:
    """Aircraft matching every given criterion (BF-04). The area applies to the latest
    known position. An empty list means no match (UC-01, alternative flow 2a).

    With `source=replay`, the aircraft heard in the minute before the simulated instant. Live,
    `heard_within_seconds` keeps the traffic of the moment, as the map shows it."""
    area = build_area(south, west, north, east)
    if scope.nothing_to_show:
        return []
    criteria = AircraftSearchCriteria(
        icao24=icao24,
        registration=registration,
        airline=airline,
        area=area,
        limit=limit,
        mode=scope.mode,
        at=scope.at,
        heard_within=None
        if heard_within_seconds is None
        else timedelta(seconds=heard_within_seconds),
    )
    return await service.search(criteria)


@router.get("/preview", summary="Preview the traffic of a live source, without storing it")
async def preview_aircraft(
    preview: PreviewDep,
    _caller: Caller,
    source: Annotated[
        DataMode, Query(description="The live source to read: `opensky` or `adsbfi`")
    ] = DataMode.ADSBFI,
) -> list[AircraftSummary]:
    """The aircraft the source sees now in its area, for a dashboard whose instance does not
    collect it. Nothing is stored: the aircraft have no flight, no history and no alert, and
    their `id` is their ICAO24 address. The answer is shared for one period of the source."""
    if not source.is_live:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The preview reads a live source: opensky or adsbfi",
        )
    try:
        return await preview.aircraft(source)
    except PreviewUnavailable as error:
        headers = (
            None
            if error.retry_after_seconds is None
            else {"Retry-After": str(error.retry_after_seconds)}
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{source.label} cannot be read now",
            headers=headers,
        ) from error


async def find_aircraft(
    service: AircraftService, aircraft_id: str, at: datetime | None = None
) -> AircraftSummary:
    aircraft = await (service.get(aircraft_id) if at is None else service.get(aircraft_id, at))
    if aircraft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    return aircraft


@router.get("/{aircraft_id}", summary="Get an aircraft record")
async def get_aircraft(
    aircraft_id: str, service: Service, _caller: Caller, scope: Scope
) -> AircraftSummary:
    """General information about one aircraft and its latest known position (BF-05).

    With `source=replay`, the position is the one at the simulated instant."""
    return await find_aircraft(service, aircraft_id, scope.at)


@router.get("/{aircraft_id}/observations", summary="Get the observation history of an aircraft")
async def get_observations(
    aircraft_id: str,
    service: Service,
    reader: Reader,
    _caller: Caller,
    scope: Scope,
    start: Annotated[datetime | None, Query(description="Start of the period, inclusive")] = None,
    end: Annotated[datetime | None, Query(description="End of the period, inclusive")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_OBSERVATIONS)] = 500,
) -> list[ObservationPoint]:
    """Flight parameters of the aircraft over time, oldest first (BF-05, BF-06).

    Returns the latest `limit` observations of the period. With `source=replay`, the period
    never goes past the simulated instant."""
    await find_aircraft(service, aircraft_id)
    if scope.at is not None and (end is None or end > scope.at):
        end = scope.at
    try:
        period = ObservationPeriod(start=start, end=end, limit=limit)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        ) from error
    return await reader.history(aircraft_id, period)


@router.get("/{aircraft_id}/flights", summary="List the flights of an aircraft")
async def get_flights(
    aircraft_id: str,
    service: Service,
    flights: FlightServiceDep,
    _caller: Caller,
    scope: Scope,
    limit: Annotated[int, Query(ge=1, le=MAX_RESULTS)] = 50,
) -> list[FlightSummary]:
    """Flights of the aircraft, the most recent first (BF-07). With `source=replay`, the
    flights that started before the simulated instant."""
    await find_aircraft(service, aircraft_id)
    if scope.at is None:
        return await flights.list_for_aircraft(aircraft_id, limit)
    return await flights.list_for_aircraft(aircraft_id, limit, scope.at)
