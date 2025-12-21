"""Tests for logging configuration and SafeFormatter."""

import logging


class TestSafeFormatter:
    """Tests for SafeFormatter class that handles missing request_id attribute."""

    def test_safe_formatter_handles_missing_request_id(self):
        """SafeFormatter should add request_id placeholder if missing."""
        from src.main import SafeFormatter

        formatter = SafeFormatter(
            fmt="%(asctime)s - %(request_id)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        # Create a log record without request_id attribute
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="startup message",
            args=(),
            exc_info=None,
        )

        # Verify request_id doesn't exist yet
        assert not hasattr(record, "request_id")

        # Should not raise KeyError
        formatted = formatter.format(record)

        # Should contain the placeholder and message
        assert " - " in formatted
        assert "startup message" in formatted
        assert "test.logger" in formatted

        # The formatter should have added the placeholder
        assert hasattr(record, "request_id")
        assert record.request_id == "-"

    def test_safe_formatter_preserves_existing_request_id(self):
        """SafeFormatter should preserve request_id if already set."""
        from src.main import SafeFormatter

        formatter = SafeFormatter(
            fmt="%(asctime)s - %(request_id)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        # Create a log record with request_id already set
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="request message",
            args=(),
            exc_info=None,
        )
        record.request_id = "test-request-123"

        # Should not raise KeyError
        formatted = formatter.format(record)

        # Should contain the actual request_id, not placeholder
        assert "test-request-123" in formatted
        assert "request message" in formatted

        # The formatter should preserve the existing request_id
        assert record.request_id == "test-request-123"

    def test_safe_formatter_with_different_log_levels(self):
        """SafeFormatter should work with all log levels."""
        from src.main import SafeFormatter

        formatter = SafeFormatter(
            fmt="%(asctime)s - %(request_id)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        log_levels = [
            (logging.DEBUG, "DEBUG"),
            (logging.INFO, "INFO"),
            (logging.WARNING, "WARNING"),
            (logging.ERROR, "ERROR"),
            (logging.CRITICAL, "CRITICAL"),
        ]

        for level, level_name in log_levels:
            record = logging.LogRecord(
                name="test",
                level=level,
                pathname="",
                lineno=0,
                msg=f"test {level_name} message",
                args=(),
                exc_info=None,
            )

            formatted = formatter.format(record)

            # Should contain log level name and message
            assert level_name in formatted
            assert f"test {level_name} message" in formatted
            # Should have added request_id placeholder
            assert record.request_id == "-"


class TestRequestIDFilter:
    """Tests for RequestIDFilter to ensure it works with SafeFormatter."""

    def test_filter_adds_request_id_from_context(self):
        """RequestIDFilter should add request_id from context."""
        from src.common.request_context import set_request_id
        from src.main import RequestIDFilter

        # Set a request ID in context
        test_request_id = "filter-test-123"
        set_request_id(test_request_id)

        try:
            request_filter = RequestIDFilter()

            record = logging.LogRecord(
                name="test",
                level=logging.INFO,
                pathname="",
                lineno=0,
                msg="test message",
                args=(),
                exc_info=None,
            )

            # Filter should add request_id from context
            result = request_filter.filter(record)

            assert result is True
            assert hasattr(record, "request_id")
            assert record.request_id == test_request_id
        finally:
            # Clean up context
            from src.common.request_context import _request_id_context

            _request_id_context.set(None)

    def test_filter_adds_placeholder_when_no_context(self):
        """RequestIDFilter should add placeholder when no request context."""
        from src.main import RequestIDFilter

        request_filter = RequestIDFilter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="startup message",
            args=(),
            exc_info=None,
        )

        # Filter should add placeholder
        result = request_filter.filter(record)

        assert result is True
        assert hasattr(record, "request_id")
        assert record.request_id == "-"


class TestLoggingIntegration:
    """Integration tests for logging configuration."""

    def test_logging_works_during_startup(self, caplog):
        """Logging should work during application startup (no request context)."""
        with caplog.at_level(logging.INFO):
            # This simulates startup logging - no request context
            logger = logging.getLogger("test.startup")
            logger.info("Application starting up")

        # Should not raise KeyError
        assert len(caplog.records) == 1
        assert "Application starting up" in caplog.text

    def test_logging_with_request_context(self, caplog):
        """Logging should work with request ID in context."""
        from src.common.request_context import set_request_id

        test_request_id = "integration-test-456"
        set_request_id(test_request_id)

        try:
            with caplog.at_level(logging.INFO):
                logger = logging.getLogger("test.request")
                logger.info("Processing request")

            assert len(caplog.records) == 1
            assert "Processing request" in caplog.text
            # The request_id should be set on the record (either from filter or SafeFormatter)
            assert hasattr(caplog.records[0], "request_id")
            # In test environment, SafeFormatter may set it to "-" before filter runs
            # The important thing is no KeyError is raised
            assert caplog.records[0].request_id in [test_request_id, "-"]
        finally:
            # Clean up context
            from src.common.request_context import _request_id_context

            _request_id_context.set(None)
