"""Límite de intentos de login fallidos por IP + usuario (memoria del proceso).

En varios workers de uvicorn cada uno tiene su propio contador.
En Render suele haber una instancia; si escaláis, valorad Redis.
"""

from __future__ import annotations

import time
from threading import Lock

from fastapi import HTTPException, Request, status

from app.config import settings

_lock = Lock()
_failures: dict[tuple[str, str], list[float]] = {}


def client_ip(request: Request) -> str:
    ff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if ff:
        return ff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _key(ip: str, username: str) -> tuple[str, str]:
    return (ip, username.strip().lower())


def _prune(timestamps: list[float]) -> list[float]:
    cutoff = time.time() - settings.login_attempt_window_seconds
    return [t for t in timestamps if t > cutoff]


def assert_login_allowed(request: Request, username: str) -> None:
    ip = client_ip(request)
    key = _key(ip, username)
    with _lock:
        failures = _prune(_failures.get(key, []))
        if len(failures) >= settings.login_max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo.",
            )


def record_login_failure(request: Request, username: str) -> None:
    ip = client_ip(request)
    key = _key(ip, username)
    with _lock:
        failures = _prune(_failures.get(key, []))
        failures.append(time.time())
        if failures:
            _failures[key] = failures
        else:
            _failures.pop(key, None)


def clear_login_failures(request: Request, username: str) -> None:
    ip = client_ip(request)
    key = _key(ip, username)
    with _lock:
        _failures.pop(key, None)
