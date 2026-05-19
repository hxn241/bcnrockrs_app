from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base
import logging

logger = logging.getLogger(__name__)


def _postgres_connect_args(url: str) -> dict:
    """Render Postgres exige TLS; si la URL ya lleva sslmode, no duplicar."""
    if not url.startswith("postgresql"):
        return {}
    if ".render.com" not in url:
        return {}
    if "sslmode=" in url.lower():
        return {}
    return {"sslmode": "require"}


_engine_kwargs = dict(
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
)
_connect_args = _postgres_connect_args(settings.database_url)
if _connect_args:
    _engine_kwargs["connect_args"] = _connect_args

engine = create_engine(settings.database_url, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


_USER_EXTRA_COLUMNS = (
    ("avatar_filename", "VARCHAR(255)"),
    ("bio", "TEXT"),
    ("moto_foto_1_filename", "VARCHAR(255)"),
    ("moto_foto_2_filename", "VARCHAR(255)"),
    ("moto_foto_3_filename", "VARCHAR(255)"),
)

_RUTA_EXTRA_COLUMNS = (
    ("map_source", "VARCHAR(16) DEFAULT 'google'"),
    ("recorrido_geojson", "TEXT"),
)


def _ensure_ruta_osm_columns() -> None:
    """Añade columnas de rutas OpenStreetMap en BD existentes (sin Alembic)."""
    try:
        insp = inspect(engine)
        if not insp.has_table("rutas"):
            return
        cols = {c["name"] for c in insp.get_columns("rutas")}
        missing = [(n, t) for n, t in _RUTA_EXTRA_COLUMNS if n not in cols]
        if not missing:
            return
        with engine.begin() as conn:
            for name, sql_type in missing:
                conn.execute(text(f"ALTER TABLE rutas ADD COLUMN {name} {sql_type}"))
        logger.info("Columnas rutas (mapa) añadidas: %s", ", ".join(n for n, _ in missing))
    except Exception as e:
        logger.warning("No se pudieron añadir columnas mapa en rutas: %s", e)


def _ensure_user_extra_columns() -> None:
    """Añade columnas opcionales de perfil en BD antiguas (sin Alembic)."""
    try:
        insp = inspect(engine)
        if not insp.has_table("users"):
            return
        cols = {c["name"] for c in insp.get_columns("users")}
        missing = [(n, t) for n, t in _USER_EXTRA_COLUMNS if n not in cols]
        if not missing:
            return
        with engine.begin() as conn:
            for name, sql_type in missing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {sql_type}"))
        logger.info("Columnas users añadidas: %s", ", ".join(n for n, _ in missing))
    except Exception as e:
        logger.warning("No se pudieron añadir columnas extra en users: %s", e)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Crea todas las tablas definidas en los modelos si no existen.
    
    PostgreSQL: SQLAlchemy crea el esquema completo desde los modelos.
    No se necesitan migraciones manuales para una instalación nueva.
    Para cambios de esquema en producción, usar Alembic.
    """
    logger.info("Inicializando base de datos PostgreSQL...")
    Base.metadata.create_all(bind=engine)
    _ensure_user_extra_columns()
    _ensure_ruta_osm_columns()
    logger.info("Base de datos inicializada correctamente.")
