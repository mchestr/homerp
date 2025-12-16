"""Tests for URL validation and SSRF protection."""

import pytest

from src.common.url_validator import (
    SSRFValidationError,
    is_ip_blocked,
    validate_webhook_url,
)


class TestIsIpBlocked:
    """Tests for IP address blocking."""

    def test_localhost_ipv4_blocked(self):
        assert is_ip_blocked("127.0.0.1") is True

    def test_localhost_ipv6_blocked(self):
        assert is_ip_blocked("::1") is True

    def test_private_10_network_blocked(self):
        assert is_ip_blocked("10.0.0.1") is True
        assert is_ip_blocked("10.255.255.255") is True

    def test_private_172_network_blocked(self):
        assert is_ip_blocked("172.16.0.1") is True
        assert is_ip_blocked("172.31.255.255") is True

    def test_private_192_network_blocked(self):
        assert is_ip_blocked("192.168.0.1") is True
        assert is_ip_blocked("192.168.255.255") is True

    def test_aws_metadata_ip_blocked(self):
        """AWS/cloud metadata endpoint must be blocked."""
        assert is_ip_blocked("169.254.169.254") is True

    def test_link_local_blocked(self):
        assert is_ip_blocked("169.254.0.1") is True

    def test_public_ip_allowed(self):
        assert is_ip_blocked("8.8.8.8") is False
        assert is_ip_blocked("1.1.1.1") is False

    def test_invalid_ip_blocked(self):
        """Invalid IP formats should be blocked for safety."""
        assert is_ip_blocked("not-an-ip") is True


class TestValidateWebhookUrl:
    """Tests for webhook URL validation."""

    def test_valid_https_url(self):
        """Valid HTTPS URLs should pass."""
        # This will fail in CI without network, but validates the logic
        url = "https://example.com/webhook"
        # Note: This may raise if DNS resolution fails in test env
        # In production, this would pass for valid public URLs
        try:
            result = validate_webhook_url(url)
            assert result == url
        except SSRFValidationError as e:
            # DNS resolution might fail in isolated test environments
            assert "resolve" in str(e).lower()

    def test_localhost_url_blocked(self):
        """Localhost URLs must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://localhost/webhook")
        assert "not allowed" in str(exc_info.value).lower()

    def test_localhost_with_port_blocked(self):
        """Localhost with port must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://localhost:8080/webhook")
        assert "not allowed" in str(exc_info.value).lower()

    def test_127_0_0_1_blocked(self):
        """127.0.0.1 must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://127.0.0.1/webhook")
        assert "blocked" in str(exc_info.value).lower()

    def test_private_ip_blocked(self):
        """Private network IPs must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://192.168.1.1/webhook")
        assert "blocked" in str(exc_info.value).lower()

        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://10.0.0.1/webhook")
        assert "blocked" in str(exc_info.value).lower()

        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://172.16.0.1/webhook")
        assert "blocked" in str(exc_info.value).lower()

    def test_aws_metadata_blocked(self):
        """AWS metadata endpoint must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://169.254.169.254/latest/meta-data/")
        assert "blocked" in str(exc_info.value).lower()

    def test_gcp_metadata_hostname_blocked(self):
        """GCP metadata hostname must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://metadata.google.internal/computeMetadata/v1/")
        assert "not allowed" in str(exc_info.value).lower()

    def test_file_scheme_blocked(self):
        """File scheme must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("file:///etc/passwd")
        assert "scheme" in str(exc_info.value).lower()

    def test_ftp_scheme_blocked(self):
        """FTP scheme must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("ftp://ftp.example.com/file")
        assert "scheme" in str(exc_info.value).lower()

    def test_empty_hostname_blocked(self):
        """URLs without hostname must be blocked."""
        with pytest.raises(SSRFValidationError):
            validate_webhook_url("http:///path")

    def test_ipv6_localhost_blocked(self):
        """IPv6 localhost must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://[::1]/webhook")
        assert "blocked" in str(exc_info.value).lower()

    def test_ipv6_link_local_blocked(self):
        """IPv6 link-local addresses must be blocked."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://[fe80::1]/webhook")
        assert "blocked" in str(exc_info.value).lower()

    def test_decimal_ip_encoding_blocked(self):
        """Decimal encoded IPs (e.g., 2130706433 for 127.0.0.1) - URL parse handles this."""
        # Note: Python's urlparse doesn't automatically decode decimal IPs
        # but we should test various encodings
        with pytest.raises(SSRFValidationError):
            validate_webhook_url("http://0x7f000001/webhook")  # Hex encoding

    def test_url_with_credentials_still_validated(self):
        """URLs with credentials should still be validated for SSRF."""
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_webhook_url("http://user:pass@localhost/webhook")
        assert "not allowed" in str(exc_info.value).lower()
