"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_data_mode

reuse.share(test_data_mode, globals())
