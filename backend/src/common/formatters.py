"""Custom log formatters for the application."""

import logging

from uvicorn.logging import AccessFormatter, DefaultFormatter

from src.common.request_context import get_request_id


class RequestIDFormatter(DefaultFormatter):
    """Formatter that includes request ID for distributed tracing."""

    def format(self, record: logging.LogRecord) -> str:
        """Add request_id to the log record before formatting."""
        record.request_id = get_request_id() or "-"
        return super().format(record)


class RequestIDAccessFormatter(AccessFormatter):
    """Access log formatter that includes request ID for distributed tracing."""

    def format(self, record: logging.LogRecord) -> str:
        """Add request_id to the log record before formatting."""
        record.request_id = get_request_id() or "-"
        return super().format(record)
