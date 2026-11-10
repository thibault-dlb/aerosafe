"""These API tests also run in the unit suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.api import test_routes_on_real_services

reuse.share(test_routes_on_real_services, globals())
