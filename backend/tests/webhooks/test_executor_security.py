"""Tests for webhook executor security features."""

from src.webhooks.executor import sanitize_headers_for_logging


class TestHeaderSanitization:
    """Tests for header sanitization to prevent credential leakage."""

    def test_authorization_header_redacted(self):
        """Authorization header should be redacted."""
        headers = {
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "Content-Type": "application/json",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized["Authorization"] == "[REDACTED]"
        assert sanitized["Content-Type"] == "application/json"

    def test_api_key_headers_redacted(self):
        """Various API key headers should be redacted."""
        headers = {
            "X-API-Key": "sk_live_xxxxxxxxxxxxx",
            "Api-Key": "my-secret-key",
            "apikey": "another-key",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized["X-API-Key"] == "[REDACTED]"
        assert sanitized["Api-Key"] == "[REDACTED]"
        assert sanitized["apikey"] == "[REDACTED]"

    def test_token_headers_redacted(self):
        """Token headers should be redacted."""
        headers = {
            "X-Auth-Token": "secret-token",
            "X-Access-Token": "access-token",
            "Token": "simple-token",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized["X-Auth-Token"] == "[REDACTED]"
        assert sanitized["X-Access-Token"] == "[REDACTED]"
        assert sanitized["Token"] == "[REDACTED]"

    def test_webhook_signature_headers_redacted(self):
        """Webhook signature headers should be redacted."""
        headers = {
            "X-Webhook-Secret": "whsec_xxxxx",
            "X-Hub-Signature": "sha1=xxxxxxx",
            "X-Hub-Signature-256": "sha256=xxxxxxx",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized["X-Webhook-Secret"] == "[REDACTED]"
        assert sanitized["X-Hub-Signature"] == "[REDACTED]"
        assert sanitized["X-Hub-Signature-256"] == "[REDACTED]"

    def test_case_insensitive_matching(self):
        """Header matching should be case-insensitive."""
        headers = {
            "AUTHORIZATION": "Bearer token",
            "x-api-KEY": "key",
            "X-Auth-TOKEN": "token",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized["AUTHORIZATION"] == "[REDACTED]"
        assert sanitized["x-api-KEY"] == "[REDACTED]"
        assert sanitized["X-Auth-TOKEN"] == "[REDACTED]"

    def test_non_sensitive_headers_preserved(self):
        """Non-sensitive headers should not be modified."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "HomERP-Webhook/1.0",
            "Accept": "application/json",
            "X-Request-Id": "12345",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized == headers

    def test_custom_auth_pattern_headers_redacted(self):
        """Headers with auth-like patterns should be redacted."""
        headers = {
            "X-Custom-Auth-Header": "secret",
            "My-Token-Value": "token",
            "Secret-Key": "key",
            "Password-Hash": "hash",
        }
        sanitized = sanitize_headers_for_logging(headers)

        assert sanitized["X-Custom-Auth-Header"] == "[REDACTED]"
        assert sanitized["My-Token-Value"] == "[REDACTED]"
        assert sanitized["Secret-Key"] == "[REDACTED]"
        assert sanitized["Password-Hash"] == "[REDACTED]"

    def test_empty_headers_handled(self):
        """Empty headers dict should work."""
        sanitized = sanitize_headers_for_logging({})
        assert sanitized == {}

    def test_original_dict_not_modified(self):
        """Original headers dict should not be modified."""
        headers = {"Authorization": "Bearer token"}
        original_value = headers["Authorization"]

        sanitize_headers_for_logging(headers)

        assert headers["Authorization"] == original_value
