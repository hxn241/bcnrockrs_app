#!/usr/bin/env python3
"""
Rellena embed_recorrido_url para rutas del catálogo que aún no lo tienen.

Ejecutar desde el directorio backend (con el venv activado):

    cd backend && ./venv/bin/python backfill_embed_recorrido.py

Usa la misma lógica que al crear/editar una ruta (compute_route_embed_url).
Enlaces cortos maps.app.goo.gl necesitan red saliente en este equipo.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import or_

from app.database import SessionLocal
from app.models import Ruta
from app.routes.maps import compute_route_embed_url


def main() -> int:
    db = SessionLocal()
    try:
        q = (
            db.query(Ruta)
            .filter(
                or_(
                    Ruta.embed_recorrido_url.is_(None),
                    Ruta.embed_recorrido_url == "",
                )
            )
            .order_by(Ruta.id)
        )
        rows = q.all()
        if not rows:
            print("No hay rutas sin embed_recorrido_url.")
            return 0

        print(f"Rutas a procesar: {len(rows)}\n")
        ok = 0
        vacio = 0
        for r in rows:
            embed = compute_route_embed_url(r.link_ruta or "")
            r.embed_recorrido_url = embed
            titulo = (r.nombre[:58] + "…") if len(r.nombre) > 58 else r.nombre
            if embed:
                ok += 1
                print(f"  [OK] id={r.id}  {titulo}")
            else:
                vacio += 1
                print(
                    f"  [--] id={r.id}  sin embed (revisa enlace o red si es goo.gl) — {titulo}"
                )

        db.commit()
        print(f"\nHecho. Con URL de embed: {ok}. Sin poder generar: {vacio}. Guardado en BD.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
