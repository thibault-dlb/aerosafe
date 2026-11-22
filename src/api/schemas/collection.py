from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CollectionRunOut(BaseModel):
    """One collection cycle of a live source."""

    model_config = ConfigDict(from_attributes=True)

    source: str = Field(description="`opensky` or `adsbfi`")
    started_at: datetime
    ended_at: datetime
    status: str
    profile: str
    received: int
    stored: int
    rejected: int
    remaining_credits: int | None
    error: str | None
    evaluation_error: str | None


class CollectionStatusOut(BaseModel):
    """State of the collection of a live source, for the Supervisor's dashboard."""

    source: str = Field(description="`opensky` or `adsbfi`")
    enabled: bool
    paused: bool
    paused_at: datetime | None
    running: bool
    profile: str
    period_seconds: int
    credits_per_day: int = Field(description="OpenSky credits a day; 0 for adsb.fi")
    daily_quota: int | None = Field(description="OpenSky credits a day; null for adsb.fi")
    authenticated: bool | None = Field(description="OpenSky account in use; null for adsb.fi")
    rate_limited_until: datetime | None
    last_run: CollectionRunOut | None
    last_success: CollectionRunOut | None
