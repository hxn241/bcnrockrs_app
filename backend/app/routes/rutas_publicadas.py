from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User, RutaPublicada, Asistente, RutaPublicadaFoto
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


def _can_edit_or_delete_published_route(route: RutaPublicada, current_user: User) -> bool:
    return current_user.is_admin is True or current_user.id == route.organizador_id


@router.get("/historico", response_model=list[RutaPublicadaResponse])
def get_historico_routes(db: Session = Depends(get_db)):
    today = _today_iso()
    routes = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
        )
        .filter(RutaPublicada.is_active.is_(True))
        .filter(RutaPublicada.dia_ruta < today)
        .order_by(RutaPublicada.dia_ruta.desc(), RutaPublicada.hora_ruta.desc())
        .all()
    )
    return routes


@router.get("", response_model=list[RutaPublicadaResponse])
def get_published_routes(db: Session = Depends(get_db)):
    today = _today_iso()
    routes = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
        )
        .filter(RutaPublicada.is_active.is_(True))
        .filter(RutaPublicada.dia_ruta >= today)
        .order_by(RutaPublicada.dia_ruta.asc(), RutaPublicada.hora_ruta.asc())
        .all()
    )
    return routes


@router.get("/calendario/{fecha}", response_model=list[RutaPublicadaResponse])
def get_routes_by_date(fecha: str, db: Session = Depends(get_db)):
    routes = (
        db.query(RutaPublicada)
        .options(
            joinedload(RutaPublicada.ruta),
            joinedload(RutaPublicada.organizador),
            joinedload(RutaPublicada.asistentes).joinedload(Asistente.user),
        )
        .filter(
            RutaPublicada.dia_ruta == fecha,
            RutaPublicada.is_active.is_(True),
        )
        .all()
    )
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

    new_published = RutaPublicada(
        **ruta_publicada.dict(),
        organizador_id=current_user.id,
    )
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

    if not _can_edit_or_delete_published_route(route, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el organizador o un administrador pueden editar la ruta",
        )

    data = body.model_dump(exclude_unset=True)
    for key in ("dia_ruta", "hora_ruta", "link_encuentro_personalizado"):
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

    if not _can_edit_or_delete_published_route(route, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el organizador o un administrador pueden eliminar la ruta",
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
def list_route_photos(ruta_publicada_id: int, db: Session = Depends(get_db)):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route or not route.is_active:
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
