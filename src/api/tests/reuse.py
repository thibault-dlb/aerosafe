"""Run the tests of one suite in another suite too.

`run_tests.ps1` measures the coverage of the `unit` and `api` suites one at a time, each against
the 80% threshold. A file covered only by the tests of the other suite shows a low figure in
that report. `share` makes the tests and fixtures of a module collectable from a second module,
so the same tests also run, and count, in the second suite. Nothing is copied: the test code
stays in its original file.
"""

from types import ModuleType


def share(source: ModuleType, namespace: dict[str, object]) -> None:
    """Expose the tests, classes and fixtures of `source` in `namespace` (a module's globals)."""
    namespace.update(
        {name: value for name, value in vars(source).items() if not name.startswith("__")}
    )
