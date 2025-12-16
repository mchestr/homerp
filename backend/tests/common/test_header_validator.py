"""Tests for HTTP header validation."""

import pytest

from src.common.header_validator import (
    HeaderValidationError,
    validate_header_name,
    validate_header_value,
    validate_headers,
)


class TestValidateHeaderName:
    """Tests for header name validation."""

    def test_valid_header_names(self):
        """Valid header names should pass."""
        valid_names = [
            "Content-Type",
            "X-Custom-Header",
            "Authorization",
            "X-API-Key",
            "Accept",
            "x-lowercase",
            "X-123-Numbers",
        ]
        for name in valid_names:
            assert validate_header_name(name) == name

    def test_empty_header_name_rejected(self):
        """Empty header name should be rejected."""
        with pytest.raises(HeaderValidationError, match="cannot be empty"):
            validate_header_name("")

    def test_header_name_with_colon_rejected(self):
        """Header name with colon should be rejected."""
        with pytest.raises(HeaderValidationError, match="Invalid header name"):
            validate_header_name("Header:Name")

    def test_header_name_with_space_rejected(self):
        """Header name with space should be rejected."""
        with pytest.raises(HeaderValidationError, match="Invalid header name"):
            validate_header_name("Header Name")

    def test_header_name_with_crlf_rejected(self):
        """Header name with CRLF should be rejected."""
        with pytest.raises(HeaderValidationError, match="Invalid header name"):
            validate_header_name("Header\r\nName")


class TestValidateHeaderValue:
    """Tests for header value validation."""

    def test_valid_header_values(self):
        """Valid header values should pass."""
        valid_values = [
            "application/json",
            "Bearer token123",
            "text/html; charset=utf-8",
            "value with spaces",
            "special!@#$%chars",
        ]
        for value in valid_values:
            assert validate_header_value(value) == value

    def test_value_with_carriage_return_rejected(self):
        """Value with carriage return should be rejected."""
        with pytest.raises(HeaderValidationError, match="forbidden characters"):
            validate_header_value("value\rwith\rcr")

    def test_value_with_newline_rejected(self):
        """Value with newline should be rejected."""
        with pytest.raises(HeaderValidationError, match="forbidden characters"):
            validate_header_value("value\nwith\nnewline")

    def test_value_with_crlf_rejected(self):
        """Value with CRLF should be rejected."""
        with pytest.raises(HeaderValidationError, match="forbidden characters"):
            validate_header_value("value\r\ninjected: header")

    def test_value_with_null_byte_rejected(self):
        """Value with null byte should be rejected."""
        with pytest.raises(HeaderValidationError, match="forbidden characters"):
            validate_header_value("value\x00with\x00null")

    def test_error_message_includes_header_name(self):
        """Error message should include header name when provided."""
        with pytest.raises(HeaderValidationError, match="for header 'X-Test'"):
            validate_header_value("bad\r\nvalue", "X-Test")


class TestValidateHeaders:
    """Tests for full header dictionary validation."""

    def test_valid_headers_pass(self):
        """Valid headers dictionary should pass."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer token",
            "X-Custom": "value",
        }
        result = validate_headers(headers)
        assert result == headers

    def test_empty_headers_pass(self):
        """Empty headers dictionary should pass."""
        assert validate_headers({}) == {}

    def test_invalid_name_rejected(self):
        """Header with invalid name should be rejected."""
        with pytest.raises(HeaderValidationError):
            validate_headers({"Invalid Name": "value"})

    def test_invalid_value_rejected(self):
        """Header with CRLF in value should be rejected."""
        with pytest.raises(HeaderValidationError):
            validate_headers({"X-Header": "value\r\nInjected: header"})

    def test_header_injection_attempt_rejected(self):
        """Common header injection attempts should be rejected."""
        # Attempt to inject a new header via CRLF
        injection_attempts = [
            {"X-Header": "value\r\nSet-Cookie: evil=cookie"},
            {"X-Header": "value\nLocation: http://evil.com"},
            {"X-Header": "value\r\nX-Injected: malicious"},
        ]
        for headers in injection_attempts:
            with pytest.raises(HeaderValidationError):
                validate_headers(headers)
