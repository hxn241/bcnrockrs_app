import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, Ruta, RutaPublicada, Asistente, RutaPublicadaFoto
from app.models.models import RutaHistorico
from app.schemas import RutaCreate, RutaResponse, RutaUpdate
from app.auth import get_current_user, get_admin_user
from app.routes.maps import compute_route_embed_url

router = APIRouter(prefix="/rutas", tags=["rutas"])


def _apply_ruta_catalogo_filters(q, ccaa: Optional[str], provincia: Optional[str]):
    """Filtros sobre plantillas del catálogo: CCAA y código INE provincia."""
    if ccaa and ccaa.strip():
        q = q.filter(Ruta.ubicacion_region == ccaa.strip().upper()[:16])
    if provincia is not None and str(provincia).strip() != "":
        prov = str(provincia).strip().zfill(2)[:2]
        q = q.filter(Ruta.ubicacion_ciudad == prov)
    return q


def _ruta_to_response(r: Ruta) -> RutaResponse:
    return RutaResponse(
        id=r.id,
        nombre=r.nombre,
        link_ruta=r.link_ruta,
        link_encuentro=r.link_encuentro,
        link_restaurante=r.link_restaurante,
        fecha=r.fecha,
        hora=r.hora,
        created_at=r.created_at,
        creador_id=r.creador_id,
        embed_recorrido_url=r.embed_recorrido_url,
        ubicacion_region=r.ubicacion_region,
        ubicacion_ciudad=r.ubicacion_ciudad,
        marcada_eliminacion=bool(getattr(r, "marcada_eliminacion", False)),
    )


@router.get("/para-publicar", response_model=List[RutaResponse])
def list_routes_for_publish(
    ccaa: Optional[str] = Query(None, description="Filtrar por código comunidad autónoma (ej. CT, MD)"),
    provincia: Optional[str] = Query(None, description="Filtrar por código INE provincia 01–52"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Todas las plantillas son visibles para cualquier usuario autenticado; filtros opcionales por zona."""
    q = db.query(Ruta)
    q = _apply_ruta_catalogo_filters(q, ccaa, provincia)
    rows = q.order_by(Ruta.nombre).all()
    return [_ruta_to_response(r) for r in rows]


@router.get("", response_model=List[RutaResponse])
def get_all_routes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(Ruta).order_by(Ruta.nombre).all()
    return [_ruta_to_response(r) for r in rows]


@router.get("/{ruta_id}", response_model=RutaResponse)
def get_route(
    ruta_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return _ruta_to_response(route)


@router.post("", response_model=RutaResponse)
def create_route(
    ruta: RutaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = ruta.model_dump()
    new_route = Ruta(**data, creador_id=current_user.id)
    new_route.embed_recorrido_url = compute_route_embed_url(new_route.link_ruta)
    db.add(new_route)
    db.commit()
    db.refresh(new_route)
    return _ruta_to_response(new_route)


@router.put("/{ruta_id}", response_model=RutaResponse)
def update_route(
    ruta_id: int,
    ruta_update: RutaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede editar plantillas del catálogo.",
        )

    update_data = ruta_update.model_dump(exclude_unset=True)
    link_changed = "link_ruta" in update_data
    for field, value in update_data.items():
        setattr(route, field, value)
    if link_changed:
        route.embed_recorrido_url = compute_route_embed_url(route.link_ruta)

    db.commit()
    db.refresh(route)
    return _ruta_to_response(route)


@router.post("/{ruta_id}/marcar-eliminacion", response_model=RutaResponse)
def marcar_ruta_para_eliminacion(
    ruta_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los administradores usan «Editar» o «Eliminar» en el catálogo; «Marcar para eliminar» es solo para usuarios sobre sus propias plantillas.",
        )
    if route.creador_id is None or route.creador_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes marcar las plantillas que tú creaste.",
        )
    route.marcada_eliminacion = True
    db.add(route)
    db.commit()
    db.refresh(route)
    return _ruta_to_response(route)


@router.delete("/{ruta_id}/marcar-eliminacion", response_model=RutaResponse)
def desmarcar_ruta_para_eliminacion(
    ruta_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    es_creador = route.creador_id is not None and route.creador_id == current_user.id
    if not current_user.is_admin and not es_creador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el creador de la plantilla o un administrador pueden quitar la marca.",
        )
    route.marcada_eliminacion = False
    db.add(route)
    db.commit()
    db.refresh(route)
    return _ruta_to_response(route)


@router.delete("/{ruta_id}")
def delete_route(
    ruta_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    tiene_activa = (
        db.query(RutaPublicada)
        .filter(
            RutaPublicada.ruta_id == ruta_id,
            RutaPublicada.is_active.is_(True),
        )
        .first()
    )
    if tiene_activa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar del catálogo: esta ruta tiene salidas publicadas en el calendario. Despublica o elimina esas salidas primero.",
        )

    publicaciones = (
        db.query(RutaPublicada).filter(RutaPublicada.ruta_id == ruta_id).all()
    )
    pub_ids = [p.id for p in publicaciones]
    uploads = Path(settings.uploads_dir)
    if pub_ids:
        db.query(RutaPublicadaFoto).filter(
            RutaPublicadaFoto.ruta_publicada_id.in_(pub_ids)
        ).delete(synchronize_session=False)
        for pid in pub_ids:
            root = uploads / "ruta_pub_fotos" / str(pid)
            if root.is_dir():
                shutil.rmtree(root, ignore_errors=True)
        db.query(Asistente).filter(Asistente.ruta_publicada_id.in_(pub_ids)).delete(
            synchronize_session=False
        )
    db.query(RutaPublicada).filter(RutaPublicada.ruta_id == ruta_id).delete(
        synchronize_session=False
    )
    db.query(RutaHistorico).filter(RutaHistorico.ruta_id == ruta_id).delete(
        synchronize_session=False
    )

    db.delete(route)
    db.commit()
    return {"message": "Route deleted"}
