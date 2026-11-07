from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class AlertStatistics:
    """Number of alerts over a period, in total and per rule code."""

    total: int
    per_rule: dict[str, int] = field(default_factory=dict)


class AlertService:
    """Single access point to alerts for the other work packages."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def statistics(self, start: datetime, end: datetime) -> AlertStatistics:
        """Count the alerts triggered between `start` and `end`, for the dashboard.

        Frozen signature. The `feat/rules-alerts` work package implements it.
        """
        raise NotImplementedError
