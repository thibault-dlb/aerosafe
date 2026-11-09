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
