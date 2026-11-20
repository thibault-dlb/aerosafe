from datetime import timedelta
from enum import StrEnum

from sqlalchemy import ColumnElement, ScalarSelect, select

from models.reference import DataSource

# A replayed aircraft counts as present at an instant when it sent a point in the minute before:
# the dataset has a point every second, so a longer window would read millions of rows, and a
# shorter one would lose the aircraft that miss a few seconds.
REPLAY_WINDOW = timedelta(minutes=1)

_CODES = {"opensky": "DIRECT", "adsbfi": "ADSBFI", "replay": "REJEU"}
_LABELS = {"opensky": "OpenSky", "adsbfi": "adsb.fi", "replay": "replay"}


class DataMode(StrEnum):
    """Which data the application shows: one of the two live collections, or the replayed
    history. Each one is a separate source: its aircraft, flights, observations and alerts are
    never mixed with those of another.

    The value is the one the API takes (`?source=adsbfi`); `code` is the one stored in the
    reference table `R_SOURCE_DONNEE`. OpenSky keeps the code `DIRECT` it had when it was the
    only live source.
    """

    OPENSKY = "opensky"
    ADSBFI = "adsbfi"
    REPLAY = "replay"

    @classmethod
    def live_modes(cls) -> tuple["DataMode", ...]:
        """The sources collected live, in the order the application starts them."""
        return (cls.OPENSKY, cls.ADSBFI)

    @property
    def code(self) -> str:
        return _CODES[self.value]

    @property
    def label(self) -> str:
        """The name of the source in logs and messages."""
        return _LABELS[self.value]

    @property
    def is_live(self) -> bool:
        """Whether the source is collected live, as opposed to the replay of the history."""
        return self is not DataMode.REPLAY

    def source_id(self) -> ScalarSelect[int]:
        """The key of this source, as a subquery: the table holds three rows, so it is free."""
        return select(DataSource.id).where(DataSource.code == self.code).scalar_subquery()

    def matches(self, source_id_column: ColumnElement[int]) -> ColumnElement[bool]:
        """A condition keeping the rows of this source."""
        return source_id_column == self.source_id()
