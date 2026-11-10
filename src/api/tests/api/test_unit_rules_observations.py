"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_rules_observations

reuse.share(test_rules_observations, globals())
