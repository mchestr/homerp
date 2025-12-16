"""AI input validation to prevent prompt injection and ensure input safety."""

import logging
import re
from typing import Annotated

from pydantic import AfterValidator, Field

logger = logging.getLogger(__name__)

# Maximum lengths for various AI inputs
MAX_PROMPT_LENGTH = 2000
MAX_CUSTOM_PROMPT_LENGTH = 500
MAX_ITEM_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 1000

# Patterns that might indicate prompt injection attempts
# These are logged but not blocked to avoid false positives
INJECTION_PATTERNS = [
    # System prompt override attempts
    r"(?i)\bignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)\b",
    r"(?i)\bdisregard\s+(previous|above|all)\s+(instructions?|prompts?|rules?)\b",
    r"(?i)\bforget\s+(previous|above|all)\s+(instructions?|prompts?|rules?)\b",
    r"(?i)\byou\s+are\s+now\s+",
    r"(?i)\bpretend\s+(to\s+be|you\s+are)\s+",
    r"(?i)\bact\s+as\s+(if|a)\s+",
    r"(?i)\brole\s*play\s+as\b",
    # Delimiter injection
    r"(?i)\bsystem\s*:\s*",
    r"(?i)\bassistant\s*:\s*",
    r"(?i)\buser\s*:\s*",
    r"(?i)\b\[system\]\b",
    r"(?i)\b\[assistant\]\b",
    r"(?i)\b\[user\]\b",
    # Instruction override
    r"(?i)\bnew\s+instructions?\s*:",
    r"(?i)\bupdated\s+instructions?\s*:",
    r"(?i)\boverride\s*:",
    # Data exfiltration attempts
    r"(?i)\brepeat\s+(back|everything|all)\b",
    r"(?i)\bshow\s+(me\s+)?(your|the)\s+(system\s+)?prompt\b",
    r"(?i)\bwhat\s+(are|is)\s+(your|the)\s+instructions?\b",
    r"(?i)\bprint\s+(your|the)\s+(system\s+)?prompt\b",
]

# Control characters that should be sanitized
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_control_characters(text: str) -> str:
    """Remove control characters from text, preserving newlines and tabs."""
    return CONTROL_CHAR_PATTERN.sub("", text)


def normalize_whitespace(text: str) -> str:
    """Normalize excessive whitespace while preserving structure."""
    # Replace multiple spaces with single space
    text = re.sub(r" +", " ", text)
    # Replace multiple newlines with max two
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip leading/trailing whitespace
    return text.strip()


def check_injection_patterns(text: str, context: str = "input") -> None:
    """
    Check for potential prompt injection patterns and log them.

    This function does NOT block the input - it only logs for monitoring.
    Blocking legitimate user input due to false positives would harm UX.

    IMPORTANT: Pattern-based detection is inherently limited and cannot catch
    all prompt injection attempts. This is a defense-in-depth measure that
    provides monitoring/alerting, not a security boundary. The primary
    defense is proper prompt construction with clear system/user separation.
    """
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text):
            logger.warning(
                f"Potential prompt injection pattern detected in {context}: "
                f"pattern='{pattern}' input_preview='{text[:100]}...'"
            )
            # Only log the first match to avoid spam
            break


def validate_ai_prompt(text: str) -> str:
    """
    Validate and sanitize an AI prompt input.

    Performs:
    - Control character removal
    - Whitespace normalization
    - Length validation
    - Injection pattern detection (logging only)

    Returns the sanitized text.
    """
    if not text:
        return ""

    # Sanitize control characters
    text = sanitize_control_characters(text)

    # Normalize whitespace
    text = normalize_whitespace(text)

    # Check for injection patterns (logging only)
    check_injection_patterns(text, "AI prompt")

    return text


def validate_custom_prompt(text: str | None) -> str | None:
    """
    Validate and sanitize an optional custom prompt for image classification.

    Returns None if input is None, otherwise returns sanitized text.
    """
    if text is None:
        return None

    # Sanitize
    text = validate_ai_prompt(text)

    # Enforce length limit
    if len(text) > MAX_CUSTOM_PROMPT_LENGTH:
        text = text[:MAX_CUSTOM_PROMPT_LENGTH]
        logger.info(f"Custom prompt truncated to {MAX_CUSTOM_PROMPT_LENGTH} characters")

    return text if text else None


def validate_item_name(text: str) -> str:
    """Validate and sanitize an item name for AI context."""
    if not text:
        return ""

    text = sanitize_control_characters(text)
    text = normalize_whitespace(text)

    # Truncate if too long
    if len(text) > MAX_ITEM_NAME_LENGTH:
        text = text[:MAX_ITEM_NAME_LENGTH]

    return text


def validate_description(text: str | None) -> str | None:
    """Validate and sanitize an item description for AI context."""
    if text is None:
        return None

    text = sanitize_control_characters(text)
    text = normalize_whitespace(text)

    # Truncate if too long
    if len(text) > MAX_DESCRIPTION_LENGTH:
        text = text[:MAX_DESCRIPTION_LENGTH]

    return text if text else None


# Pydantic validators for use in schemas
def _prompt_validator(v: str) -> str:
    """Pydantic validator for AI prompts."""
    return validate_ai_prompt(v)


def _custom_prompt_validator(v: str | None) -> str | None:
    """Pydantic validator for optional custom prompts."""
    return validate_custom_prompt(v)


# Annotated types for use in Pydantic schemas
# Note: max_length is enforced in the validator itself, not in Field,
# to allow for graceful truncation rather than hard rejection
ValidatedPrompt = Annotated[
    str,
    Field(min_length=1, max_length=MAX_PROMPT_LENGTH),
    AfterValidator(_prompt_validator),
]

ValidatedCustomPrompt = Annotated[
    str | None,
    # No max_length in Field - truncation is handled in the validator
    AfterValidator(_custom_prompt_validator),
]
