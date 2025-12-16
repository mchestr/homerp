"""Tests for cryptographic utilities."""

from src.common.crypto_utils import constant_time_compare


class TestConstantTimeCompare:
    """Tests for constant-time string comparison."""

    def test_equal_strings_return_true(self):
        """Equal strings should return True."""
        assert constant_time_compare("secret123", "secret123") is True

    def test_different_strings_return_false(self):
        """Different strings should return False."""
        assert constant_time_compare("secret123", "secret456") is False

    def test_different_length_strings_return_false(self):
        """Strings of different lengths should return False."""
        assert constant_time_compare("short", "longerstring") is False

    def test_empty_strings_equal(self):
        """Two empty strings should be equal."""
        assert constant_time_compare("", "") is True

    def test_empty_vs_nonempty_returns_false(self):
        """Empty string vs non-empty should return False."""
        assert constant_time_compare("", "nonempty") is False
        assert constant_time_compare("nonempty", "") is False

    def test_unicode_strings_work(self):
        """Unicode strings should be handled correctly."""
        assert constant_time_compare("héllo", "héllo") is True
        assert constant_time_compare("héllo", "hello") is False

    def test_uuid_strings_work(self):
        """UUID-like strings should work."""
        uuid1 = "123e4567-e89b-12d3-a456-426614174000"
        uuid2 = "123e4567-e89b-12d3-a456-426614174000"
        uuid3 = "123e4567-e89b-12d3-a456-426614174001"

        assert constant_time_compare(uuid1, uuid2) is True
        assert constant_time_compare(uuid1, uuid3) is False

    def test_case_sensitive(self):
        """Comparison should be case-sensitive."""
        assert constant_time_compare("Secret", "secret") is False
        assert constant_time_compare("SECRET", "SECRET") is True
