from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_current_user_optional
from app.config import settings
from app.database import get_db
from app.models import User, RutaPublicada, Asistente, RutaPublicadaFoto, GrupoMiembro, Grupo
from app.schemas import (
    RutaPublicadaCreate,
    RutaPublicadaUpdate,
    RutaPublicadaResponse,
    RutaPublicadaFotoResponse,
    UserResponse,
)

router = APIRouter(prefix="/rutas-publicadas", tags=["rutas publicadas"])

_ALLOWED_IMAGE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _today_iso() -> str:
    return date.today().isoformat()


def _route_day_passed(dia_ruta: str) -> bool:
    try:
        return date.fromisoformat(dia_ruta) < date.today()
    except ValueError:
        return False


def _uploads_root() -> Path:
    return Path(settings.uploads_dir)


def _foto_public_rel(ruta_publicada_id: int, filename: str) -> str:
    return f"ruta_pub_fotos/{ruta_publicada_id}/{filename}"


def _foto_to_response(row: RutaPublicadaFoto, user_obj: User | None = None) -> RutaPublicadaFotoResponse:
    rel = _foto_public_rel(row.ruta_publicada_id, row.filename)
    return RutaPublicadaFotoResponse(
        id=row.id,
        ruta_publicada_id=row.ruta_publicada_id,
        user_id=row.user_id,
        url=f"/uploads/{rel}",
        created_at=row.created_at,
        user=UserResponse.model_validate(user_obj) if user_obj else None,
    )


def _organizador_o_creador_grupo_puede_gestionar(
    db: Session, route: RutaPublicada, current_user: User
) -> bool:
    """Salida abierta: solo el organizador (más admins en _can_edit). Salida de grupo: organizador o creador del grupo."""
    if current_user.id == route.organizador_id:
        return True
    if route.visibilidad == "grupo" and route.grupo_id is not None:
        grupo = db.query(Grupo).filter(Grupo.id == route.grupo_id).first()
        if grupo is not None and grupo.creador_id == current_user.id:
            return True
    return False


def _can_edit_published_route(db: Session, route: RutaPublicada, current_user: User) -> bool:
    """Editar/despublicar: administrador; el organizador de la salida; si es salida de grupo, también el creador del grupo."""
    if current_user.is_admin is True:
        return True
    return _organizador_o_creador_grupo_puede_gestionar(db, route, current_user)


def _ids_grupos_usuario(db: Session, user_id: int) -> list[int]:
    return [
        r[0]
        for r in db.query(GrupoMiembro.grupo_id).filter(GrupoMiembro.user_id == user_id).all()
    ]


def _filter_visibilidad_salidas(q, db: Session, user: Optional[User]):
    """Salidas abiertas para todos; salidas de grupo solo si el usuario es miembro."""
    es_abierta = RutaPublicada.visibilidad == "abierta"
    if user is None:
        return q.filter(es_abierta)
    ids = _ids_grupos_usuario(db, user.id)
    if not ids:
        return q.filter(es_abierta)
    return q.filter(
        or_(
            es_abierta,
            and_(RutaPublicada.visibilidad == "grupo", RutaPublicada.grupo_id.in_(ids)),
        )
    )


def _usuario_puede_ver_salida(db: Session, route: RutaPublicada, user: Optional[User]) -> bool:
    if route.visibilidad == "abierta":
        return True
    if route.grupo_id is None:
        return True
    if user is None:
        return False
    return (
        db.query(GrupoMiembro)
        .filter(
            GrupoMiembro.grupo_id == route.grupo_id,
            GrupoMiembro.user_id == user.id,
        )
        .first()
        is not None
    )


def _apply_ubicacion_filters(
    q,
    pais: Optional[str],
    ccaa: Optional[str],
    provincia: Optional[str],
):
    """Filtros por zona. España: `ccaa` = código comunidad, `provincia` = código INE 01–52 (exacto)."""
    if pais:
        q = q.filter(RutaPublicada.ubicacion_pais == pais.strip().upper()[:2])
    if ccaa and ccaa.strip():
        q = q.filter(RutaPublicada.ubicacion_region == ccaa.strip().upper()[:8])
    if provincia is not None and str(provincia).strip() != "":
        prov = str(provincia).strip().zfill(2)[:2]
        q = q.filter(RutaPublicada.ubicacion_ciudad == prov)
    return q


@router.get("/historico", response_model=list[RutaPublicadaResponse])
def get_historico_routes(
    pais: Optional[str] = Query(None, description="Código ISO país, ej. ES"),
    ccaa: Optional[str] = Query(None, description="Código comunidad autónoma (ej. MD, CT)"),
    provincia: Optional[str] = Query(None, description="Código INE provincia 01–52"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    today = _today_iso()
    q = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
            joinedload(RutaPublicada.grupo),
        )
        .filter(RutaPublicada.is_active.is_(True))
        .filter(RutaPublicada.dia_ruta < today)
    )
    q = _filter_visibilidad_salidas(q, db, current_user)
    q = _apply_ubicacion_filters(q, pais, ccaa, provincia)
    routes = q.order_by(RutaPublicada.dia_ruta.desc(), RutaPublicada.hora_ruta.desc()).all()
    return routes


@router.get("", response_model=list[RutaPublicadaResponse])
def get_published_routes(
    pais: Optional[str] = Query(None, description="Código ISO país, ej. ES"),
    ccaa: Optional[str] = Query(None, description="Código comunidad autónoma (ej. MD, CT)"),
    provincia: Optional[str] = Query(None, description="Código INE provincia 01–52"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    today = _today_iso()
    q = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
            joinedload(RutaPublicada.grupo),
        )
        .filter(RutaPublicada.is_active.is_(True))
        .filter(RutaPublicada.dia_ruta >= today)
    )
    q = _filter_visibilidad_salidas(q, db, current_user)
    q = _apply_ubicacion_filters(q, pais, ccaa, provincia)
    routes = q.order_by(RutaPublicada.dia_ruta.asc(), RutaPublicada.hora_ruta.asc()).all()
    return routes


@router.get("/calendario/{fecha}", response_model=list[RutaPublicadaResponse])
def get_routes_by_date(
    fecha: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    q = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
            joinedload(RutaPublicada.grupo),
        )
        .filter(
            RutaPublicada.dia_ruta == fecha,
            RutaPublicada.is_active.is_(True),
        )
    )
    q = _filter_visibilidad_salidas(q, db, current_user)
    routes = q.order_by(RutaPublicada.hora_ruta.asc()).all()
    return routes


@router.post("", response_model=RutaPublicadaResponse)
def publish_route(
    ruta_publicada: RutaPublicadaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_count = db.query(RutaPublicada).filter(
        RutaPublicada.dia_ruta == ruta_publicada.dia_ruta,
        RutaPublicada.is_active.is_(True),
    ).count()

    if existing_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 routes per day reached",
        )

    payload = ruta_publicada.model_dump()
    if payload.get("visibilidad") == "grupo":
        gid = payload.get("grupo_id")
        if not gid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Indica el grupo para una salida de grupo.",
            )
        miembro = (
            db.query(GrupoMiembro)
            .filter(
                GrupoMiembro.grupo_id == gid,
                GrupoMiembro.user_id == current_user.id,
            )
            .first()
        )
        if not miembro:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Debes ser miembro del grupo para publicar una salida ahí.",
            )
    else:
        payload["grupo_id"] = None

    new_published = RutaPublicada(**payload, organizador_id=current_user.id)
    db.add(new_published)
    db.commit()
    db.refresh(new_published)
    return _load_publicada(db, new_published.id)


@router.post("/{ruta_publicada_id}/asistentes")
def add_attendee(
    ruta_publicada_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if not _usuario_puede_ver_salida(db, route, current_user):
        raise HTTPException(status_code=404, detail="Route not found")

    if _route_day_passed(route.dia_ruta):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes apuntarte a una salida que ya pasó",
        )

    existing = db.query(Asistente).filter(
        Asistente.ruta_publicada_id == ruta_publicada_id,
        Asistente.user_id == current_user.id,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already attending this route",
        )

    new_attendee = Asistente(
        ruta_publicada_id=ruta_publicada_id,
        user_id=current_user.id,
    )
    db.add(new_attendee)
    db.commit()
    db.refresh(new_attendee)
    return {"message": "Added to route", "attendee": new_attendee}


@router.delete("/{ruta_publicada_id}/asistentes")
def remove_attendee(
    ruta_publicada_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if route and not _usuario_puede_ver_salida(db, route, current_user):
        raise HTTPException(status_code=404, detail="Route not found")

    if route and _route_day_passed(route.dia_ruta):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes modificar la asistencia de una salida pasada",
        )

    attendee = db.query(Asistente).filter(
        Asistente.ruta_publicada_id == ruta_publicada_id,
        Asistente.user_id == current_user.id,
    ).first()

    if not attendee:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    db.delete(attendee)
    db.commit()
    return {"message": "Removed from route"}


def _load_publicada(db: Session, pk: int) -> RutaPublicada:
    route = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
            joinedload(RutaPublicada.grupo),
        )
        .filter(RutaPublicada.id == pk)
        .first()
    )
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.put("/{ruta_publicada_id}", response_model=RutaPublicadaResponse)
def update_published_route(
    ruta_publicada_id: int,
    body: RutaPublicadaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if not _can_edit_published_route(db, route, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el organizador, el creador del grupo (en salidas de grupo) o un administrador pueden editar la ruta",
        )

    data = body.model_dump(exclude_unset=True)

    def _miembro_grupo(gid: int) -> bool:
        return (
            db.query(GrupoMiembro)
            .filter(GrupoMiembro.grupo_id == gid, GrupoMiembro.user_id == current_user.id)
            .first()
            is not None
        )

    if "visibilidad" in data:
        route.visibilidad = data["visibilidad"]
        if route.visibilidad == "abierta":
            route.grupo_id = None
        else:
            gid = data.get("grupo_id", route.grupo_id)
            if not gid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Salida de grupo requiere grupo_id.",
                )
            if not _miembro_grupo(gid):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Debes ser miembro del grupo.",
                )
            route.grupo_id = gid
    elif "grupo_id" in data and route.visibilidad == "grupo":
        gid = data["grupo_id"]
        if not gid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="grupo_id no válido.",
            )
        if not _miembro_grupo(gid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Debes ser miembro del grupo.",
            )
        route.grupo_id = gid

    for key in (
        "dia_ruta",
        "hora_ruta",
        "link_encuentro_personalizado",
        "ubicacion_pais",
        "ubicacion_region",
        "ubicacion_ciudad",
    ):
        if key in data:
            setattr(route, key, data[key])

    db.commit()
    return _load_publicada(db, ruta_publicada_id)


@router.delete("/{ruta_publicada_id}")
def unpublish_route(
    ruta_publicada_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if not _can_edit_published_route(db, route, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el organizador de la salida, el creador del grupo (en salidas de grupo) o un administrador pueden quitarla del calendario o del histórico.",
        )

    db.query(Asistente).filter(Asistente.ruta_publicada_id == ruta_publicada_id).delete()
    db.query(RutaPublicadaFoto).filter(
        RutaPublicadaFoto.ruta_publicada_id == ruta_publicada_id
    ).delete(synchronize_session=False)
    root = _uploads_root() / "ruta_pub_fotos" / str(ruta_publicada_id)
    if root.is_dir():
        shutil.rmtree(root, ignore_errors=True)

    route.is_active = False
    db.commit()
    return {"message": "Route unpublished"}


@router.get(
    "/{ruta_publicada_id}/fotos",
    response_model=list[RutaPublicadaFotoResponse],
)
def list_route_photos(
    ruta_publicada_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route or not route.is_active:
        raise HTTPException(status_code=404, detail="Route not found")
    if not _usuario_puede_ver_salida(db, route, current_user):
        raise HTTPException(status_code=404, detail="Route not found")

    rows = (
        db.query(RutaPublicadaFoto)
        .options(joinedload(RutaPublicadaFoto.user))
        .filter(RutaPublicadaFoto.ruta_publicada_id == ruta_publicada_id)
        .order_by(RutaPublicadaFoto.created_at.desc())
        .all()
    )
    return [_foto_to_response(r, r.user) for r in rows]


@router.post(
    "/{ruta_publicada_id}/fotos",
    response_model=RutaPublicadaFotoResponse,
)
async def upload_route_photo(
    ruta_publicada_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route or not route.is_active:
        raise HTTPException(status_code=404, detail="Route not found")
    if not _usuario_puede_ver_salida(db, route, current_user):
        raise HTTPException(status_code=404, detail="Route not found")

    if not _route_day_passed(route.dia_ruta):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las fotos solo se pueden subir cuando la salida ya está en el histórico (fecha pasada).",
        )

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

    fname = f"{uuid4().hex}{ext}"
    dest_dir = _uploads_root() / "ruta_pub_fotos" / str(ruta_publicada_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / fname
    dest_path.write_bytes(data)

    row = RutaPublicadaFoto(
        ruta_publicada_id=ruta_publicada_id,
        user_id=current_user.id,
        filename=fname,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _foto_to_response(row, current_user)


@router.delete("/{ruta_publicada_id}/fotos/{foto_id}")
def delete_route_photo(
    ruta_publicada_id: int,
    foto_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(RutaPublicadaFoto)
        .filter(
            RutaPublicadaFoto.id == foto_id,
            RutaPublicadaFoto.ruta_publicada_id == ruta_publicada_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route or not _usuario_puede_ver_salida(db, route, current_user):
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    if row.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien subió la foto o un administrador pueden borrarla.",
        )

    path = _uploads_root() / "ruta_pub_fotos" / str(ruta_publicada_id) / row.filename
    db.delete(row)
    db.commit()
    if path.is_file():
        path.unlink()
    return {"message": "Foto eliminada"}
