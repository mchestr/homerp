"""Request context utilities for async-safe context propagation.

Uses Python's contextvars to safely propagate request-scoped data
through async call chains without thread-local storage issues.
"""

import uuid
from contextvars import ContextVar

# Context variable to store the current request ID
# This is async-safe and isolated per request
_request_id_context: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """
    Get the current request ID from context.

    Returns:
        The request ID string, or None if not set
    """
    return _request_id_context.get()


def set_request_id(request_id: str) -> None:
    """
    Set the request ID in the current context.

    Args:
        request_id: The request ID to store
    """
    _request_id_context.set(request_id)


def generate_request_id() -> str:
    """
    Generate a new unique request ID.

    Uses UUID4 for unpredictable, collision-resistant IDs.

    Returns:
        A new UUID4 string
    """
    return str(uuid.uuid4())
