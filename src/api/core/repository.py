from datetime import UTC, datetime
from typing import Generic, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.models import Base, TimestampMixin

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    """Reads and soft-deletes one model. Reads skip deleted rows unless asked otherwise."""

    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self._session = session
        self._model = model

    def select(self, *, include_deleted: bool = False) -> Select[tuple[ModelT]]:
        """Build the base query of the model, which callers refine."""
        statement = select(self._model)
        if include_deleted or not issubclass(self._model, TimestampMixin):
            return statement
        return statement.where(self._model.deleted_at.is_(None))

    async def get(self, identifier: int, *, include_deleted: bool = False) -> ModelT | None:
        statement = self.select(include_deleted=include_deleted).where(
            self._model.id == identifier
        )
        return await self._session.scalar(statement)

    async def soft_delete(self, instance: ModelT) -> None:
        """Mark a row as deleted. Nothing is deleted physically (conventions §6)."""
        instance.deleted_at = datetime.now(UTC)
        await self._session.flush()
