"""Request ID middleware for distributed tracing and log correlation.

Adds unique request IDs to all requests for improved observability.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.common.request_context import generate_request_id, set_request_id

# Standard header name for request IDs (used by nginx, AWS ALB, etc.)
REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that manages request IDs for tracing and correlation.

    For each incoming request:
    1. Extracts X-Request-ID header if present (for distributed tracing)
    2. Generates a new UUID4 if no incoming request ID
    3. Stores the request ID in async-safe context storage
    4. Adds X-Request-ID to the response headers

    This enables:
    - Correlating all logs from a single request
    - Tracing requests across multiple services
    - Debugging production issues with specific request IDs
    - Support workflows where users can provide request IDs
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Extract request ID from incoming header, or generate a new one
        request_id = request.headers.get(REQUEST_ID_HEADER) or generate_request_id()

        # Store in context for this request's async execution
        set_request_id(request_id)

        # Process the request
        response = await call_next(request)

        # Add request ID to response headers for client visibility
        response.headers[REQUEST_ID_HEADER] = request_id

        return response
