"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_auth_store

reuse.share(test_auth_store, globals())
