from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _sqlite_add_user_moto_columns() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        cols = {row[1] for row in rows}
        if "moto_marca" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN moto_marca VARCHAR(100)"))
        if "moto_modelo" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN moto_modelo VARCHAR(120)"))
        if "moto_anio" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN moto_anio INTEGER"))


def _sqlite_add_ruta_creador_column() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(rutas)")).fetchall()
        cols = {row[1] for row in rows}
        if "creador_id" not in cols:
            conn.execute(text("ALTER TABLE rutas ADD COLUMN creador_id INTEGER REFERENCES users(id)"))


def _sqlite_add_ruta_embed_recorrido_column() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(rutas)")).fetchall()
        cols = {row[1] for row in rows}
        if "embed_recorrido_url" not in cols:
            conn.execute(text("ALTER TABLE rutas ADD COLUMN embed_recorrido_url TEXT"))


def _sqlite_add_ruta_publicada_ubicacion_columns() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(rutas_publicadas)")).fetchall()
        cols = {row[1] for row in rows}
        if "ubicacion_pais" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE rutas_publicadas ADD COLUMN ubicacion_pais VARCHAR(2) DEFAULT 'ES' NOT NULL"
                )
            )
        if "ubicacion_region" not in cols:
            conn.execute(text("ALTER TABLE rutas_publicadas ADD COLUMN ubicacion_region VARCHAR(120)"))
        if "ubicacion_ciudad" not in cols:
            conn.execute(text("ALTER TABLE rutas_publicadas ADD COLUMN ubicacion_ciudad VARCHAR(120)"))
        if "visibilidad" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE rutas_publicadas ADD COLUMN visibilidad VARCHAR(20) DEFAULT 'abierta' NOT NULL"
                )
            )


def _sqlite_grupos_and_salida_grupo() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS grupos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre VARCHAR(80) NOT NULL UNIQUE,
                    creador_id INTEGER NOT NULL REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS grupo_miembros (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    grupo_id INTEGER NOT NULL REFERENCES grupos(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(grupo_id, user_id)
                )
                """
            )
        )
        rows = conn.execute(text("PRAGMA table_info(rutas_publicadas)")).fetchall()
        cols = {row[1] for row in rows}
        if "grupo_id" not in cols:
            conn.execute(
                text("ALTER TABLE rutas_publicadas ADD COLUMN grupo_id INTEGER REFERENCES grupos(id)")
            )
        conn.execute(text("UPDATE rutas_publicadas SET visibilidad = 'abierta' WHERE visibilidad = 'public'"))


def _sqlite_ruta_catalogo_ubicacion_columns() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(rutas)")).fetchall()
        cols = {row[1] for row in rows}
        if "ubicacion_region" not in cols:
            conn.execute(text("ALTER TABLE rutas ADD COLUMN ubicacion_region VARCHAR(16)"))
        if "ubicacion_ciudad" not in cols:
            conn.execute(text("ALTER TABLE rutas ADD COLUMN ubicacion_ciudad VARCHAR(8)"))


def _sqlite_grupo_logo_column() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(grupos)")).fetchall()
        cols = {row[1] for row in rows}
        if "logo_filename" not in cols:
            conn.execute(text("ALTER TABLE grupos ADD COLUMN logo_filename VARCHAR(255)"))


def _sqlite_rutas_marcada_eliminacion_column() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(rutas)")).fetchall()
        cols = {row[1] for row in rows}
        if "marcada_eliminacion" in cols:
            return
        conn.execute(
            text(
                "ALTER TABLE rutas ADD COLUMN marcada_eliminacion BOOLEAN NOT NULL DEFAULT 0"
            )
        )


def _sqlite_rutas_publicadas_drop_eliminar_solo_admin() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(rutas_publicadas)")).fetchall()
        cols = {row[1] for row in rows}
        if "eliminar_solo_admin" not in cols:
            return
        try:
            conn.execute(text("ALTER TABLE rutas_publicadas DROP COLUMN eliminar_solo_admin"))
        except Exception:
            pass


def _sqlite_grupo_solicitudes_table() -> None:
    if "sqlite" not in settings.database_url:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS grupo_solicitudes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    grupo_id INTEGER NOT NULL REFERENCES grupos(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(grupo_id, user_id)
                )
                """
            )
        )


def init_db():
    Base.metadata.create_all(bind=engine)
    _sqlite_add_user_moto_columns()
    _sqlite_add_ruta_creador_column()
    _sqlite_add_ruta_embed_recorrido_column()
    _sqlite_add_ruta_publicada_ubicacion_columns()
    _sqlite_grupos_and_salida_grupo()
    _sqlite_ruta_catalogo_ubicacion_columns()
    _sqlite_grupo_logo_column()
    _sqlite_grupo_solicitudes_table()
    _sqlite_rutas_marcada_eliminacion_column()
    _sqlite_rutas_publicadas_drop_eliminar_solo_admin()
