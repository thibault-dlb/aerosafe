from pydantic import Field

from config.base import CustomBaseSettings


class RulesSettings(CustomBaseSettings):
    """Settings of the rules engine, read once at start-up."""

    # R1 and R2 say nothing about an aircraft whose latest position is closer than this to the
    # edge of the area of its source: it has probably left the area. 20 km is about 80 s at
    # 250 m/s, a cycle of OpenSky and its delay, with a margin.
    RULES_EDGE_MARGIN_KM: float = Field(default=20.0, ge=0)


settings = RulesSettings()
