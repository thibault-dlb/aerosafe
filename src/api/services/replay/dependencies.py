from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Query

from core.data_mode import DataMode
from services.replay.service import ReplayService
from services.replay.store import state_store

# One service for the whole process: it keeps the period of the data for a few minutes.
replay_service = ReplayService(state_store)


def get_replay_service() -> ReplayService:
    """FastAPI dependency, overridden in tests."""
    return replay_service


ReplayServiceDep = Annotated[ReplayService, Depends(get_replay_service)]


@dataclass(frozen=True)
class DataScope:
    """Which data a request is about: the live collection, or the replay at an instant."""

    mode: DataMode = DataMode.LIVE
    at: datetime | None = None

    @property
    def nothing_to_show(self) -> bool:
        """A replay that was never started has no instant, so it has nothing to show."""
        return self.mode is DataMode.REPLAY and self.at is None


async def get_scope(
    service: ReplayServiceDep,
    source: Annotated[
        DataMode, Query(description="`live` (default) or `replay` of the historical traffic")
    ] = DataMode.LIVE,
) -> DataScope:
    if source is DataMode.LIVE:
        return DataScope()
    return DataScope(DataMode.REPLAY, await service.simulated_now())


Scope = Annotated[DataScope, Depends(get_scope)]
