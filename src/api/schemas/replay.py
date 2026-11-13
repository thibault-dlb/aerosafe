from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class ReplayStatusOut(BaseModel):
    """The replay clock. `server_time` is the real instant of the reading: between two readings,
    a client moves `simulated_at` itself, by the time gone by times `speed`, unless paused."""

    model_config = ConfigDict(from_attributes=True)

    available: bool = Field(description="Whether replayed data is in the database")
    start: datetime | None = Field(description="First instant of the replayed data")
    end: datetime | None = Field(description="Last instant of the replayed data")
    simulated_at: datetime | None = Field(
        description="Simulated instant at `server_time`; null before the first start"
    )
    speed: int = Field(description="Simulated seconds for one real second")
    paused: bool
    finished: bool = Field(description="Whether the clock reached the end of the data")
    server_time: datetime
    allowed_speeds: list[int]


class ReplayStartIn(BaseModel):
    at: AwareDatetime = Field(description="Instant to start from, inside the replayed period")
    speed: int = Field(default=1, description="Simulated seconds for one real second")


class ReplaySpeedIn(BaseModel):
    speed: int = Field(description="Simulated seconds for one real second")
