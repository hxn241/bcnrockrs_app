from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base
import logging

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # Verifica la conexión antes de usarla (importante en Render/cloud)
    pool_size=5,              # Conexiones en el pool
    max_overflow=10,          # Conexiones extra permitidas
    pool_recycle=300,         # Recicla conexiones cada 5 min (evita timeouts en Render)
)

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
