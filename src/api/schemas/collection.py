from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CollectionRunOut(BaseModel):
    """One collection cycle."""

    model_config = ConfigDict(from_attributes=True)

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
    """State of the collection, for the Supervisor's dashboard."""

    enabled: bool
    paused: bool
    paused_at: datetime | None
    running: bool
    profile: str
    period_seconds: int
    credits_per_day: int
    daily_quota: int
    authenticated: bool
    rate_limited_until: datetime | None
    last_run: CollectionRunOut | None
    last_success: CollectionRunOut | None
