from collections.abc import AsyncGenerator

import pytest

from core.database import database
from services.collection.sessions import database_session


class Sessions:
    def __init__(self) -> None:
        self.closed = False

    async def __call__(self) -> AsyncGenerator[str, None]:
        try:
            yield "session"
        finally:
            self.closed = True


async def test_the_session_is_closed_after_use(monkeypatch: pytest.MonkeyPatch) -> None:
    sessions = Sessions()
    monkeypatch.setattr(database, "get_session", sessions)

    async with database_session() as session:
        assert session == "session"

    assert sessions.closed


async def test_the_session_is_closed_at_once_when_the_caller_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sessions = Sessions()
    monkeypatch.setattr(database, "get_session", sessions)

    with pytest.raises(RuntimeError):
        async with database_session():
            raise RuntimeError("database down")

    assert sessions.closed
