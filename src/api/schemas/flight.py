from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from schemas.aircraft import ObservationPoint


class FlightSummary(BaseModel):
    """A flight in the list of an aircraft. `id` is the public ULID."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(description="Public identifier (ULID) of the flight")
    aircraft_id: str = Field(description="Public identifier of the aircraft")
    icao24: str
    registration: str | None = None
    callsign: str | None = None
    started_at: datetime = Field(description="Time of the first observation of the flight")
    ended_at: datetime | None = Field(
        default=None, description="Time of the last observation; empty while the flight goes on"
    )
    origin: str | None = Field(default=None, description="Name of the departure airport")
    destination: str | None = Field(default=None, description="Name of the arrival airport")


class FlightStatistics(BaseModel):
    """Indicators of a flight, computed from its observations (BF-08, team decision A-04)."""

    model_config = ConfigDict(frozen=True)

    observation_count: int
    duration_seconds: float = Field(description="Time between the first and last observation")
    distance_km: float = Field(description="Great-circle length of the trajectory, in km")
    mean_altitude: float | None = Field(default=None, description="In metres")
    max_altitude: float | None = Field(default=None, description="In metres")
    mean_speed: float | None = Field(default=None, description="In metres per second")
    max_speed: float | None = Field(default=None, description="In metres per second")


class TrajectoryGap(BaseModel):
    """A missing segment of the trajectory: two positions too far apart in time (UC-02, 2a)."""

    model_config = ConfigDict(frozen=True)

    start: datetime = Field(description="Time of the last position before the gap")
    end: datetime = Field(description="Time of the first position after the gap")
    duration_seconds: float


class FlightDetail(FlightSummary):
    """A flight with its trajectory, its missing segments and its statistics (BF-07, BF-08)."""

    trajectory: list[ObservationPoint] = Field(description="Observations, oldest first")
    gaps: list[TrajectoryGap]
    statistics: FlightStatistics
