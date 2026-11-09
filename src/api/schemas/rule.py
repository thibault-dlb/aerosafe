from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

CriticalityCode = Literal["LOW", "MEDIUM", "HIGH"]
# Largest value of NUMERIC(10, 3). A bound on the value itself, not before rounding: a value
# just under 10 000 000 would round to 10 000 000.000, which the column cannot store.
MAX_THRESHOLD = 9_999_999.999


class RuleOut(BaseModel):
    """A business rule and its settings (BF-13, UC-05)."""

    model_config = ConfigDict(frozen=True)

    code: str = Field(description="Code of the rule (R1, R2, ...)")
    description: str
    threshold: float = Field(description="Triggering threshold, in the rule unit")
    unit: str
    criticality: CriticalityCode | None = Field(
        default=None, description="Criticality copied into the alerts of the rule"
    )
    is_active: bool = Field(description="Whether the engine evaluates the rule")
    updated_at: datetime


class RuleUpdate(BaseModel):
    """Settings a Supervisor can change. Missing fields keep their value.

    `criticality` set to null removes the criticality of the rule.
    """

    model_config = ConfigDict(extra="forbid")

    threshold: Annotated[float, Field(ge=0, le=MAX_THRESHOLD)] | None = None
    is_active: bool | None = None
    criticality: CriticalityCode | None = None
