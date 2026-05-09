"""Crea el administrador inicial desde variables de entorno (sin contraseña en código).

Si BOOTSTRAP_ADMIN_PASSWORD y BOOTSTRAP_ADMIN_EMAIL están definidos, en el arranque
se crea el usuario BOOTSTRAP_ADMIN_USERNAME (por defecto «admin») con is_admin=True
cuando aún no existe ese username.

No sobrescribe contraseña ni email si el usuario ya existe (usa manage_users.py para eso).
"""

from __future__ import annotations

import logging

from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import User

logger = logging.getLogger(__name__)


def ensure_bootstrap_admin() -> None:
    password = settings.bootstrap_admin_password
    email = (settings.bootstrap_admin_email or "").strip()
    username = (settings.bootstrap_admin_username or "admin").strip() or "admin"

    if not password or not email:
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            if not existing.is_admin:
                existing.is_admin = True
                db.commit()
                logger.info(
                    "Usuario %r ya existía; se ha marcado como administrador.", username
                )
            return

        if db.query(User).filter(User.email == email).first():
            logger.warning(
                "BOOTSTRAP_ADMIN_EMAIL=%r ya está en uso; no se crea el usuario bootstrap.",
                email,
            )
            return

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            full_name="Administrador",
            moto_marca=None,
            moto_modelo=None,
            moto_anio=None,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        logger.info("Usuario administrador bootstrap creado (%r).", username)
    finally:
        db.close()
