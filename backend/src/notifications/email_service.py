"""Email service for sending notifications via SMTP."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from src.config import Settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SMTP."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def is_configured(self) -> bool:
        """Check if SMTP is properly configured."""
        return bool(self.settings.smtp_host and self.settings.smtp_from_email)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str | None = None,
    ) -> bool:
        """Send an email via SMTP.

        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_body: HTML content of the email
            text_body: Plain text fallback (optional)

        Returns:
            True if email was sent successfully, False otherwise
        """
        logger.info(f"EmailService.send_email called: to={to_email}, subject={subject}")
        logger.info(
            f"SMTP configuration: host={self.settings.smtp_host}, "
            f"port={self.settings.smtp_port}, from_email={self.settings.smtp_from_email}, "
            f"use_tls={self.settings.smtp_use_tls}, "
            f"username_set={bool(self.settings.smtp_username)}, "
            f"password_set={bool(self.settings.smtp_password)}"
        )

        if not self.is_configured():
            logger.warning(
                f"SMTP not configured, skipping email send: "
                f"smtp_host={self.settings.smtp_host}, "
                f"smtp_from_email={self.settings.smtp_from_email}"
            )
            return False

        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["From"] = (
                f"{self.settings.smtp_from_name} <{self.settings.smtp_from_email}>"
                if self.settings.smtp_from_name
                else self.settings.smtp_from_email
            )
            message["To"] = to_email
            message["Subject"] = subject

            # Add plain text part if provided
            if text_body:
                text_part = MIMEText(text_body, "plain", "utf-8")
                message.attach(text_part)

            # Add HTML part
            html_part = MIMEText(html_body, "html", "utf-8")
            message.attach(html_part)

            # Send via SMTP
            username = self.settings.smtp_username or None
            password = self.settings.smtp_password or None

            logger.info(
                f"Connecting to SMTP server: host={self.settings.smtp_host}, "
                f"port={self.settings.smtp_port}, use_tls={self.settings.smtp_use_tls}, "
                f"auth={'yes' if username else 'no'}"
            )

            if self.settings.smtp_use_tls:
                await aiosmtplib.send(
                    message,
                    hostname=self.settings.smtp_host,
                    port=self.settings.smtp_port,
                    username=username,
                    password=password,
                    start_tls=True,
                )
            else:
                # Warn if credentials are sent without TLS
                if username or password:
                    logger.warning(
                        "SMTP credentials will be sent without TLS encryption"
                    )
                await aiosmtplib.send(
                    message,
                    hostname=self.settings.smtp_host,
                    port=self.settings.smtp_port,
                    username=username,
                    password=password,
                )

            logger.info(
                f"Email sent successfully: to={to_email}, subject={subject}, "
                f"smtp_host={self.settings.smtp_host}"
            )
            return True

        except aiosmtplib.SMTPException as e:
            logger.error(
                f"SMTP error sending email: to={to_email}, "
                f"host={self.settings.smtp_host}, port={self.settings.smtp_port}, "
                f"error_type={type(e).__name__}, error={e}",
                exc_info=True,
            )
            return False
        except Exception as e:
            logger.error(
                f"Unexpected error sending email: to={to_email}, "
                f"host={self.settings.smtp_host}, port={self.settings.smtp_port}, "
                f"error_type={type(e).__name__}, error={e}",
                exc_info=True,
            )
            return False


def get_email_service(settings: Settings) -> EmailService:
    """Factory for EmailService."""
    return EmailService(settings)
