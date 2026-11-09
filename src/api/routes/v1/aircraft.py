from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

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

router = APIRouter(prefix="/aircraft", tags=["aircraft"])

MAX_RESULTS = 200
MAX_OBSERVATIONS = 5000


def get_aircraft_service(session: Annotated[AsyncSession, Depends(get_db)]) -> AircraftService:
    return AircraftService(session)


def get_observation_reader(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ObservationReader:
    return ObservationReader(session)


Service = Annotated[AircraftService, Depends(get_aircraft_service)]
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
) -> list[AircraftSummary]:
    """Aircraft matching every given criterion (BF-04). The area applies to the latest
    known position. An empty list means no match (UC-01, alternative flow 2a)."""
    criteria = AircraftSearchCriteria(
        icao24=icao24,
        registration=registration,
        airline=airline,
        area=build_area(south, west, north, east),
        limit=limit,
    )
    return await service.search(criteria)


async def find_aircraft(service: AircraftService, aircraft_id: str) -> AircraftSummary:
    aircraft = await service.get(aircraft_id)
    if aircraft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    return aircraft


@router.get("/{aircraft_id}", summary="Get an aircraft record")
async def get_aircraft(aircraft_id: str, service: Service, _caller: Caller) -> AircraftSummary:
    """General information about one aircraft and its latest known position (BF-05)."""
    return await find_aircraft(service, aircraft_id)


@router.get("/{aircraft_id}/observations", summary="Get the observation history of an aircraft")
async def get_observations(
    aircraft_id: str,
    service: Service,
    reader: Reader,
    _caller: Caller,
    start: Annotated[datetime | None, Query(description="Start of the period, inclusive")] = None,
    end: Annotated[datetime | None, Query(description="End of the period, inclusive")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_OBSERVATIONS)] = 500,
) -> list[ObservationPoint]:
    """Flight parameters of the aircraft over time, oldest first (BF-05, BF-06).

    Returns the latest `limit` observations of the period."""
    await find_aircraft(service, aircraft_id)
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
    limit: Annotated[int, Query(ge=1, le=MAX_RESULTS)] = 50,
) -> list[FlightSummary]:
    """Flights of the aircraft, the most recent first (BF-07)."""
    await find_aircraft(service, aircraft_id)
    return await flights.list_for_aircraft(aircraft_id, limit)
