"""Tests for app.middleware.error_handler."""
import pytest
from unittest.mock import MagicMock, AsyncMock

from app.middleware.error_handler import global_exception_handler


def _make_request(method="GET", path="/test", origin=None):
    request = MagicMock()
    request.method = method
    request.url.path = path
    request.headers = {}
    if origin:
        request.headers["origin"] = origin
    return request


class TestGlobalExceptionHandler:
    @pytest.mark.asyncio
    async def test_returns_500(self):
        request = _make_request()
        response = await global_exception_handler(request, RuntimeError("boom"))
        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_value_error_message(self):
        request = _make_request()
        response = await global_exception_handler(request, ValueError("bad input"))
        body = response.body.decode()
        assert "Solicitud" in body

    @pytest.mark.asyncio
    async def test_permission_error_message(self):
        request = _make_request()
        response = await global_exception_handler(request, PermissionError())
        body = response.body.decode()
        assert "permiso" in body

    @pytest.mark.asyncio
    async def test_file_not_found_message(self):
        request = _make_request()
        response = await global_exception_handler(request, FileNotFoundError())
        body = response.body.decode()
        assert "no encontrado" in body

    @pytest.mark.asyncio
    async def test_timeout_error_message(self):
        request = _make_request()
        response = await global_exception_handler(request, TimeoutError())
        body = response.body.decode()
        assert "tardó" in body or "tard" in body

    @pytest.mark.asyncio
    async def test_generic_error_message(self):
        request = _make_request()
        response = await global_exception_handler(request, RuntimeError("unexpected"))
        body = response.body.decode()
        assert "Error interno" in body

    @pytest.mark.asyncio
    async def test_cors_headers_for_allowed_origin(self):
        request = _make_request(origin="http://localhost:3000")
        response = await global_exception_handler(request, RuntimeError("err"))
        assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"
        assert response.headers.get("Access-Control-Allow-Credentials") == "true"

    @pytest.mark.asyncio
    async def test_no_cors_for_unknown_origin(self):
        request = _make_request(origin="http://evil.com")
        response = await global_exception_handler(request, RuntimeError("err"))
        assert "Access-Control-Allow-Origin" not in response.headers

    @pytest.mark.asyncio
    async def test_no_cors_when_no_origin(self):
        request = _make_request()
        response = await global_exception_handler(request, RuntimeError("err"))
        assert "Access-Control-Allow-Origin" not in response.headers
