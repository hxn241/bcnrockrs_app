from sqlalchemy import create_engine
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
    logger.info("Base de datos inicializada correctamente.")
