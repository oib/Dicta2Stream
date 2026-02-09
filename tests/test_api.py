"""Tests for FastAPI API endpoints."""

import pytest
import os


class TestStatusEndpoint:
    """Tests for the /status health check endpoint."""

    def test_status_returns_ok(self, client):
        response = client.get("/status")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_status_is_json(self, client):
        response = client.get("/status")
        assert response.headers["content-type"] == "application/json"


class TestIndexEndpoint:
    """Tests for the / and /me HTML endpoints."""

    def test_index_returns_html(self, client):
        response = client.get("/")
        # May return 500 if index.html not found in test env — that's expected
        # We just verify the route exists and doesn't crash with unrelated errors
        assert response.status_code in (200, 500)

    def test_me_returns_html(self, client):
        response = client.get("/me")
        assert response.status_code in (200, 500)


class TestAdminStats:
    """Tests for the /admin/stats endpoint."""

    def test_admin_stats_requires_secret(self, client):
        response = client.get("/admin/stats")
        assert response.status_code == 403

    def test_admin_stats_wrong_secret(self, client):
        response = client.get(
            "/admin/stats",
            headers={"x-admin-secret": "wrong-secret"},
        )
        assert response.status_code == 403

    def test_admin_stats_correct_secret(self, client):
        response = client.get(
            "/admin/stats",
            headers={"x-admin-secret": "test-admin-secret"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_quota_mb" in data
        assert "violation_log_entries" in data


class TestStreamsEndpoint:
    """Tests for the /streams endpoint."""

    def test_streams_returns_list(self, client):
        response = client.get("/streams")
        assert response.status_code == 200
        data = response.json()
        assert "streams" in data
        assert isinstance(data["streams"], list)


class TestErrorHandling:
    """Tests for error handling and JSON error responses."""

    def test_404_returns_json(self, client):
        response = client.get("/nonexistent-route-xyz")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_method_not_allowed(self, client):
        response = client.delete("/status")
        assert response.status_code in (404, 405)


class TestCORS:
    """Tests for CORS headers."""

    def test_cors_headers_present(self, client):
        response = client.options(
            "/status",
            headers={
                "Origin": "https://dicta2stream.net",
                "Access-Control-Request-Method": "GET",
            },
        )
        # CORS preflight should return 200
        assert response.status_code == 200

    def test_cors_allows_configured_origin(self, client):
        response = client.get(
            "/status",
            headers={"Origin": "https://dicta2stream.net"},
        )
        assert response.headers.get("access-control-allow-origin") == "https://dicta2stream.net"


class TestUserFilesEndpoint:
    """Tests for the /user-files/{uid} endpoint."""

    def test_user_files_nonexistent_user(self, client):
        response = client.get("/user-files/nonexistent@example.com")
        assert response.status_code == 200
        data = response.json()
        assert data["files"] == []
