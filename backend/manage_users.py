#!/usr/bin/env python3
"""
Gestión de usuarios desde CLI.

Usa la misma configuración que la API: en backend/.env siempre POSTGRES_URL (ruta fija al fichero).
En Render u otros hosts suele definirse DATABASE_URL en el panel; también está soportado.

Ejemplos:
  cd backend && source venv/bin/activate

  python3 manage_users.py list
  python3 manage_users.py create --username demo --email demo@mail.com --password xxxxx \\
      --full-name "Nombre" --moto-marca X --moto-modelo Y --moto-anio 2020
  python3 manage_users.py create … --admin              # fuerza administrador
  python3 manage_users.py set-admin juan
  python3 manage_users.py unset-admin juan
  python3 manage_users.py delete juan --purge --yes     # borra datos ligados y la cuenta

  python3 manage_users.py help
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import (
    User,
    Grupo,
    GrupoMiembro,
    GrupoSolicitud,
    Ruta,
    RutaPublicada,
    Asistente,
    RutaPublicadaFoto,
    RutaHistorico,
)


def _session() -> Session:
    return SessionLocal()


def resolve_user(db: Session, spec: str) -> User:
    spec = spec.strip()
    if spec.isdigit():
        u = db.get(User, int(spec))
    else:
        u = db.query(User).filter(User.username == spec).first()
    if not u:
        print(f"No existe usuario: {spec!r}", file=sys.stderr)
        sys.exit(1)
    return u


def count_admins(db: Session) -> int:
    return db.query(User).filter(User.is_admin.is_(True)).count()


def cmd_list(db: Session) -> None:
    rows = db.query(User).order_by(User.id.asc()).all()
    if not rows:
        print("(sin usuarios)")
        return
    print(f"{'id':>5}  {'username':<24}  {'email':<36}  {'admin':^5}")
    print("-" * 78)
    for u in rows:
        print(f"{u.id:>5}  {u.username:<24}  {u.email:<36}  {str(bool(u.is_admin)):^5}")


def cmd_create(db: Session, args: argparse.Namespace) -> None:
    if len(args.password) < 6:
        print("La contraseña debe tener al menos 6 caracteres.", file=sys.stderr)
        sys.exit(1)
    if args.moto_anio is not None and (args.moto_anio < 1950 or args.moto_anio > 2100):
        print("moto-anio debe estar entre 1950 y 2100.", file=sys.stderr)
        sys.exit(1)
    existing = (
        db.query(User)
        .filter((User.username == args.username) | (User.email == args.email))
        .first()
    )
    if existing:
        print("Ya existe usuario con ese username o email.", file=sys.stderr)
        sys.exit(1)

    want_admin = args.admin
    if not want_admin:
        want_admin = db.query(User).count() == 0

    hp = hash_password(args.password)
    u = User(
        username=args.username,
        email=args.email,
        hashed_password=hp,
        full_name=args.full_name or None,
        moto_marca=(args.moto_marca.strip() if args.moto_marca else None),
        moto_modelo=(args.moto_modelo.strip() if args.moto_modelo else None),
        moto_anio=args.moto_anio,
        is_admin=want_admin,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    print(f"Creado usuario id={u.id} username={u.username!r} is_admin={bool(u.is_admin)}")


def cmd_set_admin(db: Session, spec: str) -> None:
    u = resolve_user(db, spec)
    u.is_admin = True
    db.add(u)
    db.commit()
    print(f"{u.username} (id={u.id}) ahora es administrador.")


def cmd_unset_admin(db: Session, spec: str) -> None:
    u = resolve_user(db, spec)
    if u.is_admin and count_admins(db) <= 1:
        print("Es el único administrador; no se puede quitar el flag.", file=sys.stderr)
        sys.exit(1)
    u.is_admin = False
    db.add(u)
    db.commit()
    print(f"{u.username} (id={u.id}) ya no es administrador.")


def _blocking_counts(db: Session, user_id: int) -> dict[str, int]:
    return {
        "grupos_creados": db.query(Grupo).filter(Grupo.creador_id == user_id).count(),
        "salidas_organizadas": db.query(RutaPublicada)
        .filter(RutaPublicada.organizador_id == user_id)
        .count(),
        "plantillas_creadas": db.query(Ruta).filter(Ruta.creador_id == user_id).count(),
        "miembros_grupo": db.query(GrupoMiembro).filter(GrupoMiembro.user_id == user_id).count(),
        "asistencias": db.query(Asistente).filter(Asistente.user_id == user_id).count(),
    }


def purge_user(db: Session, user_id: int) -> None:
    uploads = Path(settings.uploads_dir)

    db.query(RutaPublicadaFoto).filter(RutaPublicadaFoto.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Asistente).filter(Asistente.user_id == user_id).delete(synchronize_session=False)

    pubs = db.query(RutaPublicada).filter(RutaPublicada.organizador_id == user_id).all()
    for p in pubs:
        db.query(RutaPublicadaFoto).filter(
            RutaPublicadaFoto.ruta_publicada_id == p.id
        ).delete(synchronize_session=False)
        db.query(Asistente).filter(Asistente.ruta_publicada_id == p.id).delete(
            synchronize_session=False
        )
        foto_dir = uploads / "ruta_pub_fotos" / str(p.id)
        if foto_dir.is_dir():
            shutil.rmtree(foto_dir, ignore_errors=True)

    db.query(RutaPublicada).filter(RutaPublicada.organizador_id == user_id).delete(
        synchronize_session=False
    )

    db.query(RutaHistorico).filter(RutaHistorico.organizador_id == user_id).delete(
        synchronize_session=False
    )

    db.query(GrupoMiembro).filter(GrupoMiembro.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(GrupoSolicitud).filter(GrupoSolicitud.user_id == user_id).delete(
        synchronize_session=False
    )

    grupos = db.query(Grupo).filter(Grupo.creador_id == user_id).all()
    for g in grupos:
        salidas = db.query(RutaPublicada).filter(RutaPublicada.grupo_id == g.id).all()
        for r in salidas:
            r.grupo_id = None
            if r.visibilidad == "grupo":
                r.visibilidad = "abierta"
        logo_dir = uploads / "grupo_logos" / str(g.id)
        db.delete(g)
        if logo_dir.is_dir():
            shutil.rmtree(logo_dir, ignore_errors=True)

    db.query(Ruta).filter(Ruta.creador_id == user_id).update(
        {Ruta.creador_id: None}, synchronize_session=False
    )

    u = db.get(User, user_id)
    if u:
        db.delete(u)
    db.commit()


def cmd_delete(db: Session, args: argparse.Namespace) -> None:
    u = resolve_user(db, args.username_or_id)
    if u.is_admin and count_admins(db) <= 1:
        print("Es el único administrador; borrar este usuario dejaría el sitio sin admin.", file=sys.stderr)
        sys.exit(1)

    if not args.purge:
        counts = _blocking_counts(db, u.id)
        total = sum(counts.values())
        if total > 0:
            print("Este usuario tiene datos asociados:")
            for k, v in counts.items():
                if v:
                    print(f"  - {k}: {v}")
            print("\nRepite con --purge para borrar salidas que organizó, membresías, grupos que creó")
            print("(los grupos se eliminan y las salidas del grupo pasan a abiertas), limpiar")
            print("plantillas dejando creador NULL, y eliminar la cuenta.")
            sys.exit(1)
        print("Sin datos dependientes; puedes usar delete sin --purge (solo fila users).")
        if not args.yes:
            print("Añade --yes para borrar solo la fila users.")
            sys.exit(1)
        db.delete(u)
        db.commit()
        print(f"Eliminado usuario {u.username} (id={u.id}).")
        return

    if not args.yes:
        print("--purge requiere --yes (operación irreversible).", file=sys.stderr)
        sys.exit(1)

    uid = u.id
    name = u.username
    purge_user(db, uid)
    print(f"Eliminado usuario {name!r} (id={uid}) y datos dependientes (--purge).")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gestión de usuarios KurveMaster (POSTGRES_URL en backend/.env o entorno).",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="Listar usuarios")

    def _do_list(_args):
        db = _session()
        try:
            cmd_list(db)
        finally:
            db.close()

    p_list.set_defaults(func=_do_list)

    p_c = sub.add_parser("create", help="Crear usuario (misma contraseña hasheada que la API)")
    p_c.add_argument("--username", required=True)
    p_c.add_argument("--email", required=True)
    p_c.add_argument("--password", required=True)
    p_c.add_argument("--full-name", default=None)
    p_c.add_argument("--moto-marca", default=None)
    p_c.add_argument("--moto-modelo", default=None)
    p_c.add_argument("--moto-anio", type=int, default=None)
    p_c.add_argument(
        "--admin",
        action="store_true",
        help="Marcar como administrador global (si la BD está vacía, el primer usuario ya es admin)",
    )

    def _do_create(args):
        db = _session()
        try:
            cmd_create(db, args)
        finally:
            db.close()

    p_c.set_defaults(func=_do_create)

    for name, helptxt in (
        ("set-admin", "Dar flag administrador"),
        ("unset-admin", "Quitar flag administrador"),
    ):
        p = sub.add_parser(name, help=helptxt)
        p.add_argument("username_or_id")

        def _mk(fn):
            def _run(args):
                db = _session()
                try:
                    fn(db, args.username_or_id)
                finally:
                    db.close()

            return _run

        if name == "set-admin":
            p.set_defaults(func=_mk(cmd_set_admin))
        else:
            p.set_defaults(func=_mk(cmd_unset_admin))

    p_d = sub.add_parser("delete", help="Borrar usuario")
    p_d.add_argument("username_or_id")
    p_d.add_argument(
        "--purge",
        action="store_true",
        help="Borra salidas organizadas, grupos creados, asistencias, fotos subidas, etc.",
    )
    p_d.add_argument("--yes", action="store_true", help="Confirmación obligatoria con --purge")

    def _do_delete(args):
        db = _session()
        try:
            cmd_delete(db, args)
        finally:
            db.close()

    p_d.set_defaults(func=_do_delete)

    p_h = sub.add_parser("help", help="Mostrar ayuda")
    p_h.set_defaults(func=lambda _: parser.print_help())

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
