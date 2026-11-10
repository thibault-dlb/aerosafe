"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_rules_service

reuse.share(test_rules_service, globals())
