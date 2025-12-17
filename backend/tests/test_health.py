from unittest.mock import AsyncMock, patch


def test_health_check_healthy(client):
    """Test health check returns healthy status when database is connected."""
    with patch("src.main.check_db_connectivity", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = True
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy", "database": "connected"}


def test_health_check_unhealthy(client):
    """Test health check returns unhealthy status when database is unavailable."""
    with patch("src.main.check_db_connectivity", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = False
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json() == {"status": "unhealthy", "database": "disconnected"}
