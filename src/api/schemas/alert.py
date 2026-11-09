from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlertOut(BaseModel):
    """An alert with what explains it (BF-12). Identifiers are public ULIDs."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(description="Public identifier (ULID) of the alert")
    aircraft_id: str = Field(description="Public identifier of the aircraft concerned")
    icao24: str = Field(description="ICAO 24-bit transponder address of the aircraft")
    registration: str | None = None
    rule_code: str = Field(description="Code of the rule triggered (R1, R2, ...)")
    rule_description: str
    triggered_at: datetime = Field(description="Time of the collection that triggered the rule")
    episode_ended_at: datetime | None = Field(
        default=None, description="Time the situation ended; empty while it lasts"
    )
    observed_value: float | None = Field(
        default=None, description="Value that exceeded the threshold, in the rule unit"
    )
    threshold: float | None = Field(
        default=None, description="Threshold in force when the rule triggered"
    )
    unit: str = Field(description="Unit of the value and the threshold")
    message: str
    criticality: str | None = Field(default=None, description="LOW, MEDIUM or HIGH; may be empty")
    processed_at: datetime | None = Field(
        default=None, description="Time the alert was marked as processed; empty if not"
    )


class AlertPage(BaseModel):
    """One page of alerts and the number of alerts matching the filters."""

    model_config = ConfigDict(frozen=True)

    items: list[AlertOut]
    total: int = Field(description="Number of alerts matching the filters, all pages included")


class AlertStatisticsOut(BaseModel):
    """Number of alerts triggered over a period, in total and per rule code."""

    model_config = ConfigDict(frozen=True)

    start: datetime
    end: datetime
    total: int
    per_rule: dict[str, int]
