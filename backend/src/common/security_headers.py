"""Security headers middleware for HTTP responses."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds security headers to all HTTP responses.

    These headers protect against common web vulnerabilities:
    - XSS attacks
    - Clickjacking
    - MIME type sniffing
    - Information leakage
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        # Stops browsers from trying to guess the content type
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking by disallowing embedding in frames
        # SAMEORIGIN allows embedding by same origin (needed for some UIs)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"

        # Enable browser XSS filter (legacy, but still useful for older browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Control what information is sent in Referer header
        # strict-origin-when-cross-origin: send full URL for same-origin,
        # only origin for cross-origin, nothing for downgrades
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Restrict browser features/APIs that can be used
        # Disable potentially dangerous features by default
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=()"
        )

        # Content Security Policy - restrict resource loading
        # This is a baseline policy; adjust based on frontend needs
        # Note: 'unsafe-inline' for styles needed for many UI frameworks
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'self'; "
            "form-action 'self'; "
            "base-uri 'self'"
        )

        # Remove server identification header if present
        # Prevents information disclosure about backend technology
        if "server" in response.headers:
            del response.headers["server"]

        return response


class StrictSecurityHeadersMiddleware(SecurityHeadersMiddleware):
    """
    Stricter security headers including HSTS.

    Use this in production with HTTPS only.
    HSTS tells browsers to always use HTTPS for this domain.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await super().dispatch(request, call_next)

        # HTTP Strict Transport Security
        # max-age: 1 year, includeSubDomains for all subdomains
        # Only enable in production with proper HTTPS setup
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        return response
