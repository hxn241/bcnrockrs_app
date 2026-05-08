from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User, Grupo, GrupoMiembro, GrupoSolicitud, RutaPublicada
from app.schemas import (
    GrupoCreate,
    GrupoListaItem,
    GrupoResponse,
    GrupoDetalleResponse,
    GrupoMiembroItem,
    GrupoSolicitudPendienteItem,
)

router = APIRouter(prefix="/grupos", tags=["grupos"])

_ALLOWED_IMAGE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _uploads_root() -> Path:
    return Path(settings.uploads_dir)


def _grupo_logo_url(g: Grupo) -> str | None:
    fn = getattr(g, "logo_filename", None)
    if not fn:
        return None
    return f"/uploads/grupo_logos/{g.id}/{fn}"


def _grupo_logo_dir(grupo_id: int) -> Path:
    return _uploads_root() / "grupo_logos" / str(grupo_id)


def _remove_logo_file(g: Grupo) -> None:
    fn = getattr(g, "logo_filename", None)
    if not fn:
        return
    p = _grupo_logo_dir(g.id) / fn
    if p.is_file():
        p.unlink()


def _count_miembros_por_grupo(db: Session) -> dict[int, int]:
    rows = (
        db.query(GrupoMiembro.grupo_id, func.count(GrupoMiembro.id))
        .group_by(GrupoMiembro.grupo_id)
        .all()
    )
    return {int(gid): int(c) for gid, c in rows}


def _es_miembro(db: Session, grupo_id: int, user_id: int) -> bool:
    return (
        db.query(GrupoMiembro)
        .filter(GrupoMiembro.grupo_id == grupo_id, GrupoMiembro.user_id == user_id)
        .first()
        is not None
    )


def _build_detalle(db: Session, g: Grupo, current_user: User) -> GrupoDetalleResponse:
    eres_miembro = _es_miembro(db, g.id, current_user.id)
    eres_creador = g.creador_id == current_user.id
    solicitud_row = (
        db.query(GrupoSolicitud)
        .filter(GrupoSolicitud.grupo_id == g.id, GrupoSolicitud.user_id == current_user.id)
        .first()
    )
    miembros_joined = (
        db.query(GrupoMiembro, User)
        .join(User, User.id == GrupoMiembro.user_id)
        .filter(GrupoMiembro.grupo_id == g.id)
        .order_by(User.username.asc())
        .all()
    )
    num_miembros = len(miembros_joined)
    miembros_list: list[GrupoMiembroItem] = []
    if eres_miembro or eres_creador:
        miembros_list = [
            GrupoMiembroItem(user_id=u.id, username=u.username) for _, u in miembros_joined
        ]
    solicitudes_list: list[GrupoSolicitudPendienteItem] = []
    if eres_creador:
        sol_rows = (
            db.query(GrupoSolicitud, User)
            .join(User, User.id == GrupoSolicitud.user_id)
            .filter(GrupoSolicitud.grupo_id == g.id)
            .order_by(GrupoSolicitud.created_at.asc())
            .all()
        )
        solicitudes_list = [
            GrupoSolicitudPendienteItem(user_id=u.id, username=u.username, created_at=s.created_at)
            for s, u in sol_rows
        ]
    return GrupoDetalleResponse(
        id=g.id,
        nombre=g.nombre,
        creador_id=g.creador_id,
        eres_miembro=eres_miembro,
        eres_creador=eres_creador,
        solicitud_pendiente_tuya=bool(solicitud_row) and not eres_miembro,
        num_miembros=num_miembros,
        logo_url=_grupo_logo_url(g),
        miembros=miembros_list,
        solicitudes_pendientes=solicitudes_list,
    )


def _lista_item(g: Grupo, cmap: dict[int, int]) -> GrupoListaItem:
    return GrupoListaItem(
        id=g.id,
        nombre=g.nombre,
        creador_id=g.creador_id,
        created_at=g.created_at,
        num_miembros=cmap.get(g.id, 0),
        logo_url=_grupo_logo_url(g),
    )


@router.get("", response_model=list[GrupoListaItem])
def listar_grupos(db: Session = Depends(get_db)):
    cmap = _count_miembros_por_grupo(db)
    grupos = db.query(Grupo).order_by(Grupo.nombre.asc()).all()
    return [_lista_item(g, cmap) for g in grupos]


@router.get("/solicitudes-pendientes/mias", response_model=list[int])
def ids_grupos_con_solicitud_pendiente(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """IDs de grupos en los que el usuario tiene una solicitud de ingreso pendiente."""
    rows = (
        db.query(GrupoSolicitud.grupo_id)
        .filter(GrupoSolicitud.user_id == current_user.id)
        .all()
    )
    return [int(r[0]) for r in rows]


@router.get("/mios", response_model=list[GrupoListaItem])
def mis_grupos(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cmap = _count_miembros_por_grupo(db)
    rows = (
        db.query(Grupo)
        .join(GrupoMiembro, GrupoMiembro.grupo_id == Grupo.id)
        .filter(GrupoMiembro.user_id == current_user.id)
        .order_by(Grupo.nombre.asc())
        .all()
    )
    return [_lista_item(g, cmap) for g in rows]


@router.get("/{grupo_id}/detalle", response_model=GrupoDetalleResponse)
def grupo_detalle(
    grupo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return _build_detalle(db, g, current_user)


@router.post("", response_model=GrupoResponse, status_code=status.HTTP_201_CREATED)
def crear_grupo(
    body: GrupoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = Grupo(nombre=body.nombre, creador_id=current_user.id)
    db.add(g)
    db.flush()
    db.add(GrupoMiembro(grupo_id=g.id, user_id=current_user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un grupo con ese nombre.",
        )
    db.refresh(g)
    return GrupoResponse(
        id=g.id,
        nombre=g.nombre,
        creador_id=g.creador_id,
        created_at=g.created_at,
        logo_url=_grupo_logo_url(g),
    )


@router.post("/{grupo_id}/logo", response_model=GrupoResponse)
async def subir_logo_grupo(
    grupo_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.creador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el creador del grupo puede cambiar el logo.")

    ct = (file.content_type or "").split(";")[0].strip().lower()
    ext = _ALLOWED_IMAGE.get(ct)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Formato no permitido. Usa JPEG, PNG o WebP.",
        )

    data = await file.read()
    max_bytes = max(1, settings.max_upload_mb) * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Imagen demasiado grande (máx. {settings.max_upload_mb} MB).",
        )

    _remove_logo_file(g)
    fname = f"{uuid4().hex}{ext}"
    dest_dir = _grupo_logo_dir(grupo_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / fname
    dest_path.write_bytes(data)

    g.logo_filename = fname
    db.add(g)
    db.commit()
    db.refresh(g)
    return GrupoResponse(
        id=g.id,
        nombre=g.nombre,
        creador_id=g.creador_id,
        created_at=g.created_at,
        logo_url=_grupo_logo_url(g),
    )


@router.delete("/{grupo_id}/logo", response_model=GrupoResponse)
def eliminar_logo_grupo(
    grupo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.creador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el creador del grupo puede quitar el logo.")
    _remove_logo_file(g)
    g.logo_filename = None
    db.add(g)
    db.commit()
    db.refresh(g)
    return GrupoResponse(
        id=g.id,
        nombre=g.nombre,
        creador_id=g.creador_id,
        created_at=g.created_at,
        logo_url=None,
    )


@router.post("/{grupo_id}/solicitar")
def solicitar_entrada(
    grupo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if _es_miembro(db, grupo_id, current_user.id):
        raise HTTPException(status_code=400, detail="Ya perteneces a este grupo.")
    existe = (
        db.query(GrupoSolicitud)
        .filter(GrupoSolicitud.grupo_id == grupo_id, GrupoSolicitud.user_id == current_user.id)
        .first()
    )
    if existe:
        raise HTTPException(status_code=400, detail="Ya tienes una solicitud pendiente.")
    db.add(GrupoSolicitud(grupo_id=grupo_id, user_id=current_user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya tienes una solicitud pendiente.")
    return {"message": "Solicitud enviada. El administrador del grupo debe aceptarla."}


@router.delete("/{grupo_id}/solicitar")
def cancelar_solicitud(
    grupo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(GrupoSolicitud)
        .filter(GrupoSolicitud.grupo_id == grupo_id, GrupoSolicitud.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No tienes una solicitud pendiente para este grupo.")
    db.delete(row)
    db.commit()
    return {"message": "Solicitud cancelada."}


@router.post("/{grupo_id}/solicitudes/{user_id}/aceptar")
def aceptar_solicitud(
    grupo_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.creador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el creador del grupo puede aceptar solicitudes.")
    sol = (
        db.query(GrupoSolicitud)
        .filter(GrupoSolicitud.grupo_id == grupo_id, GrupoSolicitud.user_id == user_id)
        .first()
    )
    if not sol:
        raise HTTPException(status_code=404, detail="No hay solicitud pendiente de ese usuario.")
    if _es_miembro(db, grupo_id, user_id):
        db.delete(sol)
        db.commit()
        return {"message": "El usuario ya era miembro; solicitud eliminada."}
    db.add(GrupoMiembro(grupo_id=grupo_id, user_id=user_id))
    db.delete(sol)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo añadir al miembro.")
    return {"message": "Solicitud aceptada."}


@router.post("/{grupo_id}/solicitudes/{user_id}/rechazar")
def rechazar_solicitud(
    grupo_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.creador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el creador del grupo puede rechazar solicitudes.")
    sol = (
        db.query(GrupoSolicitud)
        .filter(GrupoSolicitud.grupo_id == grupo_id, GrupoSolicitud.user_id == user_id)
        .first()
    )
    if not sol:
        raise HTTPException(status_code=404, detail="No hay solicitud pendiente de ese usuario.")
    db.delete(sol)
    db.commit()
    return {"message": "Solicitud rechazada."}


@router.delete("/{grupo_id}/salir")
def salir_de_grupo(
    grupo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(GrupoMiembro)
        .filter(GrupoMiembro.grupo_id == grupo_id, GrupoMiembro.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No eres miembro de este grupo")
    db.delete(row)
    db.commit()
    return {"message": "Has salido del grupo"}


@router.delete("/{grupo_id}/miembros/{user_id}")
def expulsar_miembro(
    grupo_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.creador_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el creador del grupo puede expulsar miembros.",
        )
    if user_id == g.creador_id:
        raise HTTPException(
            status_code=400,
            detail="No puedes expulsar al creador del grupo.",
        )
    row = (
        db.query(GrupoMiembro)
        .filter(GrupoMiembro.grupo_id == grupo_id, GrupoMiembro.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Ese usuario no es miembro del grupo.")
    db.delete(row)
    db.commit()
    return {"message": "Miembro expulsado del grupo."}


@router.delete("/{grupo_id}")
def eliminar_grupo(
    grupo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    g = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.creador_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el creador del grupo puede eliminarlo.",
        )

    salidas = db.query(RutaPublicada).filter(RutaPublicada.grupo_id == grupo_id).all()
    for r in salidas:
        r.grupo_id = None
        if r.visibilidad == "grupo":
            r.visibilidad = "abierta"

    logo_dir = _grupo_logo_dir(g.id)
    _remove_logo_file(g)

    db.delete(g)
    db.commit()

    if logo_dir.is_dir():
        shutil.rmtree(logo_dir, ignore_errors=True)

    return {"message": "Grupo eliminado."}
