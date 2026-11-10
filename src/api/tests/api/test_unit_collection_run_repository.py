"""These unit tests also run in the API suite (see `tests/reuse.py`)."""

from tests import reuse
from tests.unit import test_collection_run_repository

reuse.share(test_collection_run_repository, globals())
