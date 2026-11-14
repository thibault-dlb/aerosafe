from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from schemas.alert import AlertOut


class StatisticsPeriod(StrEnum):
    """How far back the chart of alerts goes."""

    DAY = "24h"
    WEEK = "7d"
    MONTH = "30d"


class DashboardCounters(BaseModel):
    """The figures at the top of the dashboard."""

    model_config = ConfigDict(frozen=True)

    active_alerts: int = Field(description="Alerts whose situation lasts")
    unprocessed_alerts: int = Field(description="Alerts no Supervisor has processed yet")
    alerts_24h: int = Field(description="Alerts triggered in the last 24 hours")


class CollectionRunSummary(BaseModel):
    """One collection cycle, as much as the mini history shows."""

    model_config = ConfigDict(frozen=True)

    started_at: datetime
    status: str


class CollectionSummary(BaseModel):
    """State of the collection, readable by every account (the controls are the Supervisor's)."""

    model_config = ConfigDict(frozen=True)

    enabled: bool
    paused: bool
    running: bool
    last_success_at: datetime | None = None
    remaining_credits: int | None = Field(
        default=None, description="OpenSky credits left after the last successful run"
    )
    recent_runs: list[CollectionRunSummary] = Field(description="Latest runs, newest first")


class DashboardOut(BaseModel):
    """What the dashboard shows, in one answer."""

    model_config = ConfigDict(frozen=True)

    counters: DashboardCounters
    active_alerts: list[AlertOut] = Field(description="The latest alerts whose situation lasts")
    alerted_aircraft: list[AlertOut] = Field(
        default_factory=list,
        description="For each aircraft with an active alert, its most critical one",
    )
    collection: CollectionSummary


class StatisticsSlice(BaseModel):
    """Alerts triggered during one hour or one day, per rule code."""

    model_config = ConfigDict(frozen=True)

    start: datetime
    total: int
    per_rule: dict[str, int]


class DashboardStatisticsOut(BaseModel):
    """The chart of alerts: a slice per hour (24 h) or per day (7 d, 30 d), the empty ones too."""

    model_config = ConfigDict(frozen=True)

    period: StatisticsPeriod
    unit: str = Field(description="`hour` or `day`")
    start: datetime
    end: datetime
    total: int
    slices: list[StatisticsSlice]
