"""URL validation utilities for SSRF protection."""

import ipaddress
import logging
import os
import socket
from functools import lru_cache
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


@lru_cache
def _get_allowed_networks() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """Parse allowed networks from settings (cached)."""
    from src.config import get_settings

    settings = get_settings()
    if not settings.allowed_networks:
        return []

    networks = []
    for network_str in settings.allowed_networks.split(","):
        network_str = network_str.strip()
        if not network_str:
            continue
        try:
            networks.append(ipaddress.ip_network(network_str, strict=True))
        except ValueError as e:
            logger.error(
                f"CRITICAL: Invalid network in ALLOWED_NETWORKS will be ignored: "
                f"{network_str}: {e}"
            )

    if networks:
        logger.info(
            f"SSRF allowlist configured with {len(networks)} network(s): "
            f"{[str(n) for n in networks]}"
        )

    return networks


def _is_dns_skip_enabled() -> bool:
    """Check if DNS resolution should be skipped (for testing only)."""
    return os.environ.get("WEBHOOK_SKIP_DNS_RESOLUTION", "").lower() == "true"


# Domains that are safe without DNS resolution (used only in test mode)
SAFE_TEST_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "test.com",
}

# Networks that should never be accessible via webhooks
BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),  # "This" network
    ipaddress.ip_network("10.0.0.0/8"),  # Private (RFC 1918)
    ipaddress.ip_network("100.64.0.0/10"),  # Carrier-grade NAT (RFC 6598)
    ipaddress.ip_network("127.0.0.0/8"),  # Loopback (RFC 1122)
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local / AWS metadata
    ipaddress.ip_network("172.16.0.0/12"),  # Private (RFC 1918)
    ipaddress.ip_network("192.0.0.0/24"),  # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),  # TEST-NET-1
    ipaddress.ip_network("192.88.99.0/24"),  # 6to4 Relay Anycast
    ipaddress.ip_network("192.168.0.0/16"),  # Private (RFC 1918)
    ipaddress.ip_network("198.18.0.0/15"),  # Benchmark testing
    ipaddress.ip_network("198.51.100.0/24"),  # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),  # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),  # Multicast
    ipaddress.ip_network("240.0.0.0/4"),  # Reserved for future use
    ipaddress.ip_network("255.255.255.255/32"),  # Broadcast
    # IPv6 equivalents
    ipaddress.ip_network("::1/128"),  # Loopback
    ipaddress.ip_network("::/128"),  # Unspecified
    ipaddress.ip_network("::ffff:0:0/96"),  # IPv4-mapped
    ipaddress.ip_network("64:ff9b::/96"),  # IPv4/IPv6 translation
    ipaddress.ip_network("100::/64"),  # Discard prefix
    ipaddress.ip_network("fc00::/7"),  # Unique local (RFC 4193)
    ipaddress.ip_network("fe80::/10"),  # Link-local
    ipaddress.ip_network("ff00::/8"),  # Multicast
]

# Blocked hostnames
BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",  # GCP metadata
    "metadata.internal",  # Generic cloud metadata
}

# Allowed URL schemes
ALLOWED_SCHEMES = {"http", "https"}


class SSRFValidationError(ValueError):
    """Raised when URL validation fails due to SSRF risk."""

    pass


def is_ip_in_allowlist(ip_str: str) -> bool:
    """Check if an IP address is explicitly allowed via ALLOWED_NETWORKS.

    This checks the user-configured allowlist that bypasses SSRF protection
    for specific trusted networks (e.g., internal services).
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        allowed_networks = _get_allowed_networks()
        return any(ip in network for network in allowed_networks)
    except ValueError:
        return False


def is_ip_blocked(ip_str: str) -> bool:
    """Check if an IP address belongs to a blocked network.

    An IP is NOT blocked if it's in the ALLOWED_NETWORKS allowlist,
    even if it would otherwise be in a blocked range.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        # Check allowlist first - allowed IPs bypass block check
        allowed_networks = _get_allowed_networks()
        if any(ip in network for network in allowed_networks):
            return False
        return any(ip in network for network in BLOCKED_NETWORKS)
    except ValueError:
        # Invalid IP address format
        return True


def resolve_hostname(hostname: str) -> list[str]:
    """Resolve hostname to IP addresses."""
    try:
        # Get all IP addresses for the hostname
        results = socket.getaddrinfo(
            hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM
        )
        return list({result[4][0] for result in results})
    except socket.gaierror as e:
        raise SSRFValidationError(f"Failed to resolve hostname: {e}") from e


def validate_webhook_url(url: str) -> str:
    """
    Validate a webhook URL for SSRF vulnerabilities.

    This function performs comprehensive validation:
    1. Checks URL scheme (only http/https allowed)
    2. Checks for blocked hostnames
    3. Resolves hostname and checks all resulting IPs against blocked networks

    Args:
        url: The URL to validate

    Returns:
        The validated URL string

    Raises:
        SSRFValidationError: If the URL poses an SSRF risk
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise SSRFValidationError(f"Invalid URL format: {e}") from e

    # Check scheme
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise SSRFValidationError(
            f"URL scheme '{parsed.scheme}' not allowed. Use http or https."
        )

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("URL must contain a hostname")

    # Check for blocked hostnames
    hostname_lower = hostname.lower()
    if hostname_lower in BLOCKED_HOSTNAMES:
        raise SSRFValidationError(f"Hostname '{hostname}' is not allowed")

    # Check if hostname is already an IP address
    try:
        ip = ipaddress.ip_address(hostname)
        if is_ip_blocked(str(ip)):
            raise SSRFValidationError(
                f"IP address '{hostname}' is in a blocked network range"
            )
        return url
    except ValueError:
        # Not an IP address, continue to resolve hostname
        pass

    # In test mode, allow safe domains without DNS resolution
    # This is used for testing webhooks without requiring real DNS
    if _is_dns_skip_enabled():
        # Check if base domain (without subdomain) is in safe test domains
        domain_parts = hostname_lower.split(".")
        if len(domain_parts) >= 2:
            base_domain = ".".join(domain_parts[-2:])
            if base_domain in SAFE_TEST_DOMAINS:
                logger.debug(f"Skipping DNS resolution for test domain: {hostname}")
                return url

    # Resolve hostname and check all resulting IPs
    try:
        ip_addresses = resolve_hostname(hostname)
    except SSRFValidationError:
        raise
    except Exception as e:
        raise SSRFValidationError(f"Failed to validate hostname: {e}") from e

    if not ip_addresses:
        raise SSRFValidationError(f"Hostname '{hostname}' did not resolve to any IP")

    for ip_str in ip_addresses:
        if is_ip_blocked(ip_str):
            logger.warning(
                f"Webhook URL blocked: {hostname} resolves to blocked IP {ip_str}"
            )
            raise SSRFValidationError(
                f"Hostname '{hostname}' resolves to a blocked network range"
            )

    return url


def validate_webhook_url_sync(url: str) -> str:
    """
    Synchronous wrapper for webhook URL validation.

    Used for Pydantic validators which need to be synchronous.
    """
    return validate_webhook_url(url)
