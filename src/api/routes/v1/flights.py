from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import CurrentUser, get_current_user
from schemas.flight import FlightDetail
from services.flights import FlightService

router = APIRouter(prefix="/flights", tags=["flights"])


def get_flight_service(session: Annotated[AsyncSession, Depends(get_db)]) -> FlightService:
    return FlightService(session)


FlightServiceDep = Annotated[FlightService, Depends(get_flight_service)]
# Users and Supervisors can both view trajectories (team decision C-06).
Caller = Annotated[CurrentUser, Depends(get_current_user)]


@router.get("/{flight_id}", summary="Get a flight with its trajectory and statistics")
async def get_flight(flight_id: str, service: FlightServiceDep, _caller: Caller) -> FlightDetail:
    """The trajectory of a flight, its missing segments and its statistics (BF-07, BF-08).

    When observations are missing, the partial trajectory is returned and `gaps` lists the
    missing segments (UC-02, alternative flow 2a)."""
    flight = await service.get(flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight not found")
    return flight
