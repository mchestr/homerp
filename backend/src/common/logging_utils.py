"""Logging utilities for safe and consistent log output."""


def mask_email(email: str | None) -> str:
    """
    Mask email address for logging to protect PII.

    Transforms user@example.com to u***@example.com for GDPR compliance
    and to reduce PII exposure in logs stored in third-party systems.

    Args:
        email: Email address to mask, or None

    Returns:
        Masked email string, or 'None' if input is None
    """
    if not email:
        return "None"
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        return f"{local}***@{domain}"
    return f"{local[0]}***@{domain}"
