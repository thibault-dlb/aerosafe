"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_replay_clock

reuse.share(test_replay_clock, globals())
