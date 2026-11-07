from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession


class RulesEngine:
    """Evaluates the active rules. The scheduler calls it right after each collection."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def evaluate(self, now: datetime) -> None:
        """Evaluate the rules for the collection that ran at `now`.

        Frozen signature. The `feat/rules-alerts` work package implements it.
        """
        raise NotImplementedError
