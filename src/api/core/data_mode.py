from datetime import timedelta
from enum import StrEnum

from sqlalchemy import ColumnElement, ScalarSelect, select

from models.reference import DataSource

# A replayed aircraft counts as present at an instant when it sent a point in the minute before:
# the dataset has a point every second, so a longer window would read millions of rows, and a
# shorter one would lose the aircraft that miss a few seconds.
REPLAY_WINDOW = timedelta(minutes=1)


class DataMode(StrEnum):
    """Which data the application shows: the live collection or the replayed history.

    The value is the one the API takes (`?source=live`); `code` is the one stored in the
    reference table `R_SOURCE_DONNEE`.
    """

    LIVE = "live"
    REPLAY = "replay"

    @property
    def code(self) -> str:
        return "DIRECT" if self is DataMode.LIVE else "REJEU"

    def source_id(self) -> ScalarSelect[int]:
        """The key of this source, as a subquery: the table holds two rows, so it is free."""
        return select(DataSource.id).where(DataSource.code == self.code).scalar_subquery()

    def matches(self, source_id_column: ColumnElement[int]) -> ColumnElement[bool]:
        """A condition keeping the rows of this source."""
        return source_id_column == self.source_id()
