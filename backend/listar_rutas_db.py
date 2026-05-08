"""Lista filas de la tabla rutas (catálogo base). Uso: python listar_rutas_db.py"""
import sqlite3
import sys
from pathlib import Path

db = Path(__file__).resolve().parent / "rutas_moto.db"
if not db.exists():
    print(f"No se encuentra {db}", file=sys.stderr)
    sys.exit(1)

conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
rows = conn.execute(
    "SELECT id, nombre, link_ruta, link_encuentro, link_restaurante FROM rutas ORDER BY id"
).fetchall()
print(f"Total rutas: {len(rows)}\n")
for r in rows:
    d = dict(r)
    print(f"[{d['id']}] {d['nombre']}")
    print(f"    ruta:      {d['link_ruta']}")
    print(f"    encuentro: {d['link_encuentro']}")
    rest = d["link_restaurante"] or ""
    if rest:
        print(f"    rest:      {rest}")
    print()
