class SourceError(Exception):
    """Base error of a live source. The collection cycle turns it into a status; it never
    reaches the API."""


class SourceUnavailable(SourceError):
    """The source is down, too slow, or answered something unusable."""


class SourceRateLimited(SourceError):
    """The source refuses requests for a while: no request until the delay is over.

    `retry_after_seconds` is the delay the source announced, or None when it gave none.
    """

    def __init__(self, message: str, retry_after_seconds: int | None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds
