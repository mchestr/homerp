"""Tests for logging configuration."""

import logging


class TestLogConfig:
    """Tests for log configuration function."""

    def test_log_config_has_required_fields(self):
        """_get_log_config should have all required dictConfig fields."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        assert config_dict["version"] == 1
        assert config_dict["disable_existing_loggers"] is False
        assert "formatters" in config_dict
        assert "handlers" in config_dict
        assert "loggers" in config_dict

    def test_log_config_has_default_formatter(self):
        """_get_log_config should have default and access formatters."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        assert "default" in config_dict["formatters"]
        assert "access" in config_dict["formatters"]

    def test_log_config_has_handlers(self):
        """_get_log_config should have default and access handlers."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        assert "default" in config_dict["handlers"]
        assert "access" in config_dict["handlers"]

    def test_log_config_has_loggers(self):
        """_get_log_config should configure root, uvicorn, and app loggers."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        assert "" in config_dict["loggers"]  # root logger
        assert "src" in config_dict["loggers"]  # app logger
        assert "uvicorn.access" in config_dict["loggers"]
        assert "uvicorn.error" in config_dict["loggers"]

    def test_log_config_reduces_third_party_noise(self):
        """_get_log_config should set noisy libraries to WARNING level."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        assert config_dict["loggers"]["httpcore"]["level"] == "WARNING"
        assert config_dict["loggers"]["httpx"]["level"] == "WARNING"

    def test_log_config_includes_request_id_in_format(self):
        """Log format should include request_id placeholder."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        default_fmt = config_dict["formatters"]["default"]["fmt"]
        access_fmt = config_dict["formatters"]["access"]["fmt"]

        assert "%(request_id)s" in default_fmt
        assert "%(request_id)s" in access_fmt

    def test_log_config_uses_custom_formatters(self):
        """_get_log_config should use RequestIDFormatter classes."""
        from src.main import _get_log_config

        config_dict = _get_log_config()

        assert (
            config_dict["formatters"]["default"]["()"]
            == "src.common.formatters.RequestIDFormatter"
        )
        assert (
            config_dict["formatters"]["access"]["()"]
            == "src.common.formatters.RequestIDAccessFormatter"
        )


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
        """dictConfig should accept _get_log_config without errors."""
        from logging.config import dictConfig

        from src.main import _get_log_config

        # This should not raise any exceptions
        config_dict = _get_log_config()
        dictConfig(config_dict)
