"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_collection_cycle

reuse.share(test_collection_cycle, globals())
