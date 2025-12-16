"""HTTP header validation to prevent header injection attacks."""

import re

# Characters that are not allowed in header names (RFC 7230)
# Header names must be tokens: 1*tchar where tchar is defined in RFC 7230
HEADER_NAME_PATTERN = re.compile(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$")

# CRLF and other control characters that could enable header injection
CRLF_PATTERN = re.compile(r"[\r\n\x00]")


class HeaderValidationError(ValueError):
    """Raised when header validation fails."""

    pass


def validate_header_name(name: str) -> str:
    """
    Validate an HTTP header name.

    Args:
        name: The header name to validate

    Returns:
        The validated header name

    Raises:
        HeaderValidationError: If the header name is invalid
    """
    if not name:
        raise HeaderValidationError("Header name cannot be empty")

    if not HEADER_NAME_PATTERN.match(name):
        raise HeaderValidationError(
            f"Invalid header name '{name}': must contain only valid token characters"
        )

    return name


def validate_header_value(value: str, header_name: str = "") -> str:
    """
    Validate an HTTP header value for CRLF injection.

    Args:
        value: The header value to validate
        header_name: Optional header name for error messages

    Returns:
        The validated header value

    Raises:
        HeaderValidationError: If the header value contains CRLF or null bytes
    """
    if CRLF_PATTERN.search(value):
        header_context = f" for header '{header_name}'" if header_name else ""
        raise HeaderValidationError(
            f"Invalid header value{header_context}: "
            "contains forbidden characters (CR, LF, or null byte)"
        )

    return value


def validate_headers(headers: dict[str, str]) -> dict[str, str]:
    """
    Validate a dictionary of HTTP headers.

    Args:
        headers: Dictionary of header names to values

    Returns:
        The validated headers dictionary

    Raises:
        HeaderValidationError: If any header name or value is invalid
    """
    validated = {}
    for name, value in headers.items():
        validate_header_name(name)
        validate_header_value(value, name)
        validated[name] = value

    return validated
