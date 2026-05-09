#!/usr/bin/env python3
"""
Script de migración de datos: SQLite → PostgreSQL

Uso (desde la carpeta backend/):
    python migrate_sqlite_to_postgres.py \\
        --sqlite sqlite:///./rutas_moto.db \\
        --postgres "postgresql://USER:PASS@HOST/DBNAME" \\
        --confirm-wipe

Sin pasar --postgres, la URL de destino se resuelve así (en este orden): variables de entorno
POSTGRES_URL o DATABASE_URL, o las mismas claves definidas en backend/.env.

Con variables de entorno:
    SQLITE_URL=sqlite:///./rutas_moto.db \\
    POSTGRES_URL=postgresql://... \\
    python migrate_sqlite_to_postgres.py --confirm-wipe

IMPORTANTE:
    - Con --confirm-wipe se ejecuta TRUNCATE … CASCADE en todas las tablas del destino:
      se pierden usuarios, rutas y demás datos que solo existan en ese Postgres.
    - Copia filas desde SQLite en orden seguro para las FK.
    - Render Postgres exige TLS: si la URL apunta a *.render.com y no lleva sslmode,
      el script usa connect_args sslmode=require.

Archivos que NO migra (hay que copiarlos a mano al servidor de Render / disco persistente):
    backend/uploads/ruta_pub_fotos/
    backend/uploads/grupo_logos/
"""

import argparse
import os
import sys
import logging
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values
from sqlalchemy import create_engine, text, inspect, Boolean

_BACKEND_DIR = Path(__file__).resolve().parent

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Vaciar destino: orden hijos → padres (CASCADE cubre el resto).
TABLES_TRUNCATE = [
    "asistentes",
    "ruta_publicada_fotos",
    "rutas_publicadas",
    "rutas_historico",
    "rutas",
    "grupo_solicitudes",
    "grupo_miembros",
    "grupos",
    "users",
]

# Inserción respetando foreign keys
TABLES_ORDER = [
    "users",
    "grupos",
    "grupo_miembros",
    "grupo_solicitudes",
    "rutas",
    "rutas_publicadas",
    "ruta_publicada_fotos",
    "asistentes",
    "rutas_historico",
]


def get_table_columns(engine, table_name: str) -> list[str]:
    inspector = inspect(engine)
    return [col["name"] for col in inspector.get_columns(table_name)]


def get_boolean_columns(engine, table_name: str) -> set[str]:
    inspector = inspect(engine)
    bool_cols = set()
    for col in inspector.get_columns(table_name):
        if isinstance(col["type"], Boolean):
            bool_cols.add(col["name"])
    return bool_cols


def convert_row(row_dict: dict, bool_cols: set[str]) -> dict:
    result = {}
    for k, v in row_dict.items():
        if k in bool_cols and isinstance(v, int):
            result[k] = bool(v)
        else:
            result[k] = v
    return result


def _mask_postgres_url(url: str) -> str:
    """Host + BD + query para logs, sin usuario ni contraseña."""
    try:
        p = urlparse(url)
        host = p.hostname or "(sin host)"
        port = f":{p.port}" if p.port else ""
        path = (p.path or "").lstrip("/") or "(sin base de datos)"
        q = f"?{p.query}" if p.query else ""
        scheme = p.scheme or "postgresql"
        return f"{scheme}://{host}{port}/{path}{q}"
    except Exception:
        return "(URL Postgres no válida)"


def _postgres_url_from_backend_dotenv() -> str | None:
    """Lee POSTGRES_URL o DATABASE_URL desde backend/.env (misma convención que Settings)."""
    env_path = _BACKEND_DIR / ".env"
    if not env_path.is_file():
        return None
    vals = dotenv_values(env_path)
    url = (vals.get("POSTGRES_URL") or vals.get("DATABASE_URL") or "").strip()
    return url or None


def _resolve_postgres_url(cli_value: str | None) -> str | None:
    if cli_value:
        return cli_value.strip() or None
    return (
        (os.environ.get("POSTGRES_URL") or "").strip()
        or (os.environ.get("DATABASE_URL") or "").strip()
        or _postgres_url_from_backend_dotenv()
        or None
    )


def _reject_placeholder_postgres_url(url: str) -> None:
    low = url.strip().lower()
    problems = []
    if "host.region-postgres.render.com" in low:
        problems.append("host del ejemplo (HOST.region-postgres.render.com)")
    if "//usuario:" in low:
        problems.append("usuario del ejemplo (USUARIO)")
    if ":contraseña@" in low:
        problems.append("contraseña del ejemplo (CONTRASEÑA)")
    tail = low.split("//", 1)[-1].split("@", 1)[-1].split("/", 1)
    db_part = tail[1].split("?")[0] if len(tail) > 1 else ""
    if db_part == "nombre_bd":
        problems.append("nombre de BD del ejemplo (NOMBRE_BD)")
    if problems:
        logger.error(
            "POSTGRES_URL parece copiada del ejemplo sin datos reales: %s.",
            "; ".join(problems),
        )
        logger.error(
            "Render → tu Postgres → Connections → copia «External Database URL» "
            "(ej. …dpg-xxxxx.frankfurt-postgres.render.com/kurvemaster_pgsql) y "
            "pega esa URL completa en backend/.env como POSTGRES_URL=…"
        )
        sys.exit(1)


def _dst_engine(postgres_url: str):
    kw: dict = dict(pool_pre_ping=True)
    lowered = postgres_url.lower()
    if (
        ".render.com" in postgres_url or ".neon.tech" in postgres_url
    ) and "sslmode=" not in lowered:
        kw["connect_args"] = {"sslmode": "require"}
    return create_engine(postgres_url, **kw)


def migrate(sqlite_url: str, postgres_url: str, *, confirm_wipe: bool) -> None:
    if not confirm_wipe:
        logger.error(
            "El PostgreSQL de destino se vaciará por completo antes de importar. "
            "Ejecuta de nuevo con --confirm-wipe para continuar."
        )
        sys.exit(1)

    _reject_placeholder_postgres_url(postgres_url)

    logger.info("Origen  (SQLite):     %s", sqlite_url)
    logger.info("Destino (PostgreSQL): %s", _mask_postgres_url(postgres_url))

    backend_root = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, backend_root)

    src_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    dst_engine = _dst_engine(postgres_url)

    logger.info("Creando esquema en PostgreSQL si no existe...")
    from app.models import Base

    Base.metadata.create_all(bind=dst_engine)
    logger.info("Esquema listo.")

    with src_engine.connect() as src_conn, dst_engine.connect() as dst_conn:
        logger.warning(
            "Vaciando tablas en PostgreSQL (TRUNCATE … CASCADE). "
            "Los datos actuales del servidor se eliminan."
        )
        tbl_list = ", ".join(f'"{t}"' for t in TABLES_TRUNCATE)
        dst_conn.execute(text(f"TRUNCATE TABLE {tbl_list} RESTART IDENTITY CASCADE"))
        dst_conn.commit()

        for table in TABLES_ORDER:
            try:
                result = src_conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
                count = result.scalar()
            except Exception:
                logger.warning("Tabla '%s' no existe en SQLite, saltando...", table)
                continue

            if count == 0:
                logger.info("  %s: vacía en SQLite, saltando.", table)
                continue

            logger.info("  %s: migrando %s filas...", table, count)

            src_cols = get_table_columns(src_engine, table)
            dst_cols = get_table_columns(dst_engine, table)
            common_cols = [c for c in src_cols if c in dst_cols]
            if not common_cols:
                logger.warning("  %s: sin columnas comunes, saltando.", table)
                continue

            cols_str = ", ".join(f'"{c}"' for c in common_cols)
            bool_cols = get_boolean_columns(dst_engine, table)

            rows = src_conn.execute(text(f"SELECT {cols_str} FROM \"{table}\"")).fetchall()

            placeholders = ", ".join(f":{c}" for c in common_cols)
            insert_sql = text(
                f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders})'
            )
            for row in rows:
                row_dict = dict(zip(common_cols, row))
                row_dict = convert_row(row_dict, bool_cols)
                dst_conn.execute(insert_sql, row_dict)

            dst_conn.commit()
            logger.info("  %s: %s filas migradas ✓", table, count)

        logger.info("Ajustando secuencias de PostgreSQL...")
        for table in TABLES_ORDER:
            try:
                dst_conn.execute(
                    text(
                        f"""
                        SELECT setval(
                            pg_get_serial_sequence('{table}', 'id'),
                            COALESCE((SELECT MAX(id) FROM "{table}"), 0) + 1,
                            false
                        )
                        """
                    )
                )
                dst_conn.commit()
            except Exception as e:
                logger.warning("  No se pudo ajustar secuencia de '%s': %s", table, e)

    logger.info("")
    logger.info("Migración completada.")
    logger.info(
        "Si tenías fotos de rutas o logos de grupo, copia la carpeta backend/uploads/ "
        "al entorno donde corre el backend en Render."
    )


def _is_postgres_url(url: str) -> bool:
    u = url.strip().lower()
    return u.startswith("postgresql://") or u.startswith("postgres://")


def main():
    parser = argparse.ArgumentParser(description="Migra datos de SQLite a PostgreSQL")
    parser.add_argument(
        "--sqlite",
        default=os.environ.get("SQLITE_URL", "sqlite:///./rutas_moto.db"),
        help="URL de SQLite (default: sqlite:///./rutas_moto.db)",
    )
    parser.add_argument(
        "--postgres",
        default=None,
        help="URL PostgreSQL (si se omite: POSTGRES_URL o DATABASE_URL en el entorno o en backend/.env)",
    )
    parser.add_argument(
        "--confirm-wipe",
        action="store_true",
        help="Obligatorio: confirma que puedes borrar todos los datos del Postgres destino.",
    )
    args = parser.parse_args()

    postgres_url = _resolve_postgres_url(args.postgres)
    if not postgres_url:
        logger.error(
            "Falta la URL de Postgres: define POSTGRES_URL (o DATABASE_URL) en backend/.env, "
            "en el entorno, o pasa --postgres."
        )
        sys.exit(1)

    if "sqlite" not in args.sqlite.lower():
        logger.error("--sqlite debe ser una URL de SQLite")
        sys.exit(1)
    if not _is_postgres_url(postgres_url):
        logger.error("La URL de destino debe ser postgresql:// o postgres://")
        sys.exit(1)

    migrate(args.sqlite, postgres_url, confirm_wipe=args.confirm_wipe)


if __name__ == "__main__":
    main()
