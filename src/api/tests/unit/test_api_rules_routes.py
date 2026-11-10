"""These API tests also run in the unit suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.api import test_rules_routes

reuse.share(test_rules_routes, globals())
