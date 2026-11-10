"""These API tests also run in the unit suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.api import test_security

reuse.share(test_security, globals())
