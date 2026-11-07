class Scheduler:
    """Runs the collection, then the rules engine, inside the API process.

    The application starts and stops it, so `main.py` does not change when it is implemented.
    Frozen signature. The `feat/collection-dashboard` work package implements it.
    """

    async def start(self) -> None:
        """Start the periodic cycles. Does nothing for now."""

    async def stop(self) -> None:
        """Stop the periodic cycles. Does nothing for now."""
