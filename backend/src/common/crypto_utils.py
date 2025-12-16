"""Cryptographic utilities for secure operations."""

import secrets


def constant_time_compare(a: str, b: str) -> bool:
    """
    Compare two strings in constant time to prevent timing attacks.

    This function uses secrets.compare_digest which is designed to prevent
    timing attacks by ensuring the comparison takes the same amount of time
    regardless of where the strings differ.

    Args:
        a: First string to compare
        b: Second string to compare

    Returns:
        True if the strings are equal, False otherwise
    """
    # secrets.compare_digest requires bytes or ASCII strings
    # Convert to bytes for comparison
    return secrets.compare_digest(a.encode("utf-8"), b.encode("utf-8"))
