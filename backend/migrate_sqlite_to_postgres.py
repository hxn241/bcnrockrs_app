#!/usr/bin/env python3
"""
Script de migración de datos: SQLite → PostgreSQL

Uso:
    python migrate_sqlite_to_postgres.py \
        --sqlite sqlite:///./rutas_moto.db \
        --postgres postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db

O con variables de entorno:
    SQLITE_URL=sqlite:///./rutas_moto.db \
    POSTGRES_URL=postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db \
    python migrate_sqlite_to_postgres.py

IMPORTANTE:
    - Ejecutar ANTES de arrancar la app con PostgreSQL por primera vez.
    - El script crea las tablas en PostgreSQL y copia todos los datos.
    - Los IDs y secuencias se ajustan automáticamente.
"""

import argparse
import os
import sys
import logging
from sqlalchemy import create_engine, text, inspect, Boolean, Integer
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Orden de inserción respetando foreign keys
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
    """Devuelve los nombres de columnas de una tabla."""
    inspector = inspect(engine)
    return [col["name"] for col in inspector.get_columns(table_name)]


def get_boolean_columns(engine, table_name: str) -> set[str]:
    """Devuelve los nombres de columnas booleanas en PostgreSQL."""
    inspector = inspect(engine)
    bool_cols = set()
    for col in inspector.get_columns(table_name):
        if isinstance(col["type"], Boolean):
            bool_cols.add(col["name"])
    return bool_cols


def convert_row(row_dict: dict, bool_cols: set[str]) -> dict:
    """Convierte valores SQLite (0/1) a booleanos Python para columnas boolean."""
    result = {}
    for k, v in row_dict.items():
        if k in bool_cols and isinstance(v, int):
            result[k] = bool(v)
        else:
            result[k] = v
    return result


def migrate(sqlite_url: str, postgres_url: str) -> None:
    logger.info(f"Origen  (SQLite):     {sqlite_url}")
    logger.info(f"Destino (PostgreSQL): {postgres_url}")

    src_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    dst_engine = create_engine(postgres_url, pool_pre_ping=True)

    # Importar modelos y crear esquema en PostgreSQL
    logger.info("Creando esquema en PostgreSQL...")
    # Añadir el directorio del backend al path para importar los modelos
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from app.models import Base
    Base.metadata.create_all(bind=dst_engine)
    logger.info("Esquema creado.")

    with src_engine.connect() as src_conn, dst_engine.connect() as dst_conn:
        for table in TABLES_ORDER:
            # Verificar que la tabla existe en origen
            try:
                result = src_conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
            except Exception:
                logger.warning(f"Tabla '{table}' no existe en SQLite, saltando...")
                continue

            if count == 0:
                logger.info(f"  {table}: vacía, saltando.")
                continue

            logger.info(f"  {table}: migrando {count} filas...")

            # Obtener columnas comunes entre origen y destino
            src_cols = get_table_columns(src_engine, table)
            dst_cols = get_table_columns(dst_engine, table)
            common_cols = [c for c in src_cols if c in dst_cols]
            cols_str = ", ".join(f'"{c}"' for c in common_cols)

            # Detectar columnas booleanas en destino (PostgreSQL)
            bool_cols = get_boolean_columns(dst_engine, table)

            # Leer todos los datos del origen
            rows = src_conn.execute(
                text(f"SELECT {cols_str} FROM {table}")
            ).fetchall()

            if not rows:
                continue

            # Limpiar tabla destino antes de insertar (por si se re-ejecuta)
            dst_conn.execute(text(f'DELETE FROM "{table}"'))

            # Insertar en destino con conversión de tipos
            placeholders = ", ".join(f":{c}" for c in common_cols)
            insert_sql = text(
                f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders})'
            )
            for row in rows:
                row_dict = dict(zip(common_cols, row))
                row_dict = convert_row(row_dict, bool_cols)
                dst_conn.execute(insert_sql, row_dict)

            dst_conn.commit()
            logger.info(f"  {table}: {count} filas migradas ✓")

        # Resetear secuencias de PostgreSQL para que los IDs futuros no colisionen
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
                logger.warning(f"  No se pudo ajustar secuencia de '{table}': {e}")

    logger.info("")
    logger.info("✅ Migración completada con éxito.")
    logger.info("   Ahora puedes arrancar la app apuntando a PostgreSQL.")


def main():
    parser = argparse.ArgumentParser(description="Migra datos de SQLite a PostgreSQL")
    parser.add_argument(
        "--sqlite",
        default=os.environ.get("SQLITE_URL", "sqlite:///./rutas_moto.db"),
        help="URL de SQLite (default: sqlite:///./rutas_moto.db)",
    )
    parser.add_argument(
        "--postgres",
        default=os.environ.get(
            "POSTGRES_URL",
            "postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db",
        ),
        help="URL de PostgreSQL",
    )
    args = parser.parse_args()

    if "sqlite" not in args.sqlite:
        logger.error("--sqlite debe ser una URL de SQLite")
        sys.exit(1)
    if "postgresql" not in args.postgres and "postgres" not in args.postgres:
        logger.error("--postgres debe ser una URL de PostgreSQL")
        sys.exit(1)

    migrate(args.sqlite, args.postgres)


if __name__ == "__main__":
    main()
