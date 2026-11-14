from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AircraftSummary(BaseModel):
    """An aircraft as returned by the search and the aircraft record (BF-04, BF-05).

    `id` is the public ULID: the internal key never leaves the API.
    The position is the latest known one, or empty when the aircraft never sent one.
    """

    model_config = ConfigDict(frozen=True)

    id: str = Field(description="Public identifier (ULID) of the aircraft")
    icao24: str = Field(description="ICAO 24-bit transponder address, 6 lowercase hex characters")
    registration: str | None = None
    model: str | None = Field(default=None, description="Label of the aircraft model")
    airline: str | None = Field(default=None, description="Name of the operating airline")
    last_contact_at: datetime | None = Field(
        default=None, description="Time of the latest message received from the aircraft"
    )
    latitude: float | None = Field(default=None, description="Latest known latitude, in degrees")
    longitude: float | None = Field(default=None, description="Latest known longitude, in degrees")
    altitude: float | None = Field(
        default=None, description="Altitude of the latest observation, in metres"
    )
    heading: float | None = Field(
        default=None, description="True track of the latest observation, in degrees from north"
    )
    on_ground: bool | None = Field(
        default=None, description="True when the latest observation is on the ground"
    )


class ObservationPoint(BaseModel):
    """One state vector of an aircraft: its flight parameters at one time (BF-06).

    A missing value means OpenSky did not send it.
    """

    model_config = ConfigDict(frozen=True)

    last_contact_at: datetime = Field(description="Time of the message")
    position_at: datetime | None = Field(
        default=None, description="Time of the position; empty when the message had none"
    )
    latitude: float | None = Field(default=None, description="Latitude, in degrees")
    longitude: float | None = Field(default=None, description="Longitude, in degrees")
    altitude: float | None = Field(default=None, description="Altitude, in metres")
    speed: float | None = Field(default=None, description="Ground speed, in metres per second")
    heading: float | None = Field(default=None, description="True track, in degrees from north")
    on_ground: bool = Field(description="True when the aircraft is on the ground")
    flight_id: str | None = Field(
        default=None, description="Public identifier of the flight the observation belongs to"
    )
