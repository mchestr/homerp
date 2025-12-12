"""Template parsing utilities for webhook body templates."""

import re
from typing import Any


def get_nested_value(data: dict, path: str) -> Any:
    """Get a nested value from dict using dot notation.

    Args:
        data: The dictionary to search
        path: Dot-separated path (e.g., "feedback.subject")

    Returns:
        The value at the path, or None if not found
    """
    keys = path.split(".")
    value = data
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return None
        if value is None:
            return None
    return value


def render_template(template: str, context: dict) -> str:
    """Render a template string with {{variable}} placeholders.

    Supports:
    - Simple variables: {{feedback.subject}}
    - Nested values: {{user.email}}
    - Missing values become empty strings

    Args:
        template: Template string with {{variable}} placeholders
        context: Dictionary with values for template variables

    Returns:
        Rendered template string
    """

    def replace_var(match: re.Match) -> str:
        var_path = match.group(1).strip()
        value = get_nested_value(context, var_path)
        if value is None:
            return ""
        return str(value)

    # Match {{variable}} patterns
    pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}"
    return re.sub(pattern, replace_var, template)


def build_default_payload(event_type: str, context: dict) -> dict:
    """Build default JSON payload for an event type.

    Args:
        event_type: The event type identifier
        context: The event context data

    Returns:
        Standard webhook payload structure
    """
    return {
        "event": event_type,
        "timestamp": context.get("timestamp"),
        "data": context,
    }
