from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Ruta, RutaPublicada, Asistente
from app.models.models import RutaHistorico
from app.schemas import RutaCreate, RutaResponse, RutaUpdate
from app.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/rutas", tags=["rutas"])

@router.get("", response_model=List[RutaResponse])
def get_all_routes(db: Session = Depends(get_db)):
    routes = db.query(Ruta).all()
    return routes

@router.get("/{ruta_id}", response_model=RutaResponse)
def get_route(ruta_id: int, db: Session = Depends(get_db)):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route

@router.post("", response_model=RutaResponse)
def create_route(
    ruta: RutaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_route = Ruta(**ruta.dict())
    db.add(new_route)
    db.commit()
    db.refresh(new_route)
    return new_route

@router.put("/{ruta_id}", response_model=RutaResponse)
def update_route(
    ruta_id: int,
    ruta_update: RutaUpdate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    route = db.query(Ruta).filter(Ruta.id == ruta_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = ruta_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(route, field, value)
    
    db.commit()
    db.refresh(route)
    return route

@router.delete("/{ruta_id}")
def delete_route(
    ruta_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
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

    # Sin publicaciones activas: limpiar restos (inactivas, historial) y el registro del catálogo
    publicaciones = (
        db.query(RutaPublicada).filter(RutaPublicada.ruta_id == ruta_id).all()
    )
    pub_ids = [p.id for p in publicaciones]
    if pub_ids:
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
