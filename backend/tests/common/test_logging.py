"""Tests for logging configuration."""

import logging


class TestLogConfig:
    """Tests for LogConfig class."""

    def test_log_config_has_required_fields(self):
        """LogConfig should have all required dictConfig fields."""
        from src.main import LogConfig

        config = LogConfig()
        config_dict = config.model_dump()

        assert config_dict["version"] == 1
        assert config_dict["disable_existing_loggers"] is False
        assert "formatters" in config_dict
        assert "handlers" in config_dict
        assert "loggers" in config_dict

    def test_log_config_has_default_formatter(self):
        """LogConfig should have default and access formatters."""
        from src.main import LogConfig

        config = LogConfig()
        config_dict = config.model_dump()

        assert "default" in config_dict["formatters"]
        assert "access" in config_dict["formatters"]

    def test_log_config_has_handlers(self):
        """LogConfig should have default and access handlers."""
        from src.main import LogConfig

        config = LogConfig()
        config_dict = config.model_dump()

        assert "default" in config_dict["handlers"]
        assert "access" in config_dict["handlers"]

    def test_log_config_has_loggers(self):
        """LogConfig should configure root, uvicorn, and app loggers."""
        from src.main import LogConfig

        config = LogConfig()
        config_dict = config.model_dump()

        assert "" in config_dict["loggers"]  # root logger
        assert "src" in config_dict["loggers"]  # app logger
        assert "uvicorn.access" in config_dict["loggers"]
        assert "uvicorn.error" in config_dict["loggers"]

    def test_log_config_reduces_third_party_noise(self):
        """LogConfig should set noisy libraries to WARNING level."""
        from src.main import LogConfig

        config = LogConfig()
        config_dict = config.model_dump()

        assert config_dict["loggers"]["httpcore"]["level"] == "WARNING"
        assert config_dict["loggers"]["httpx"]["level"] == "WARNING"


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
        finally:
            # Clean up context
            from src.common.request_context import _request_id_context

            _request_id_context.set(None)

    def test_dictconfig_can_be_applied(self):
        """dictConfig should accept LogConfig without errors."""
        from logging.config import dictConfig

        from src.main import LogConfig

        # This should not raise any exceptions
        config = LogConfig()
        dictConfig(config.model_dump())
