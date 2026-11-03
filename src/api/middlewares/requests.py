import uuid
from urllib.parse import quote

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logger import get_logger

logger = get_logger()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs every request with a unique id, returned in the X-Request-ID header."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request_logger = logger.bind(request_id=request_id)

        safe_path = quote(request.url.path, safe="/")
        request_logger.info(f"Incoming request {request.method} {safe_path}")

        try:
            response: Response = await call_next(request)
        except Exception as error:
            request_logger.exception(f"Unhandled error: {error}")
            raise

        request_logger.info(f"Response {response.status_code} for {request.method} {safe_path}")
        response.headers["X-Request-ID"] = request_id
        return response
