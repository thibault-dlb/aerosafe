"""These API tests also run in the unit suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.api import test_replay_history_routes

reuse.share(test_replay_history_routes, globals())
