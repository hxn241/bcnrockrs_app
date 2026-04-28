from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import User, RutaPublicada, Asistente
from app.schemas import RutaPublicadaCreate, RutaPublicadaUpdate, RutaPublicadaResponse
from app.auth import get_current_user

router = APIRouter(prefix="/rutas-publicadas", tags=["rutas publicadas"])

@router.get("", response_model=List[RutaPublicadaResponse])
def get_published_routes(db: Session = Depends(get_db)):
    routes = db.query(RutaPublicada).filter(RutaPublicada.is_active == True).all()
    return routes

@router.get("/calendario/{fecha}", response_model=List[RutaPublicadaResponse])
def get_routes_by_date(fecha: str, db: Session = Depends(get_db)):
    routes = db.query(RutaPublicada).filter(
        RutaPublicada.dia_ruta == fecha,
        RutaPublicada.is_active == True
    ).all()
    return routes

@router.post("", response_model=RutaPublicadaResponse)
def publish_route(
    ruta_publicada: RutaPublicadaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check limit of 5 routes per day
    existing_count = db.query(RutaPublicada).filter(
        RutaPublicada.dia_ruta == ruta_publicada.dia_ruta,
        RutaPublicada.is_active == True
    ).count()
    
    if existing_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 routes per day reached"
        )
    
    new_published = RutaPublicada(
        **ruta_publicada.dict(),
        organizador_id=current_user.id
    )
    db.add(new_published)
    db.commit()
    db.refresh(new_published)
    return new_published

@router.post("/{ruta_publicada_id}/asistentes")
def add_attendee(
    ruta_publicada_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if route exists
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Check if user is already attending
    existing = db.query(Asistente).filter(
        Asistente.ruta_publicada_id == ruta_publicada_id,
        Asistente.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already attending this route"
        )
    
    new_attendee = Asistente(
        ruta_publicada_id=ruta_publicada_id,
        user_id=current_user.id
    )
    db.add(new_attendee)
    db.commit()
    db.refresh(new_attendee)
    return {"message": "Added to route", "attendee": new_attendee}

@router.delete("/{ruta_publicada_id}/asistentes")
def remove_attendee(
    ruta_publicada_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attendee = db.query(Asistente).filter(
        Asistente.ruta_publicada_id == ruta_publicada_id,
        Asistente.user_id == current_user.id
    ).first()
    
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    db.delete(attendee)
    db.commit()
    return {"message": "Removed from route"}

def _can_edit_or_delete_published_route(route: RutaPublicada, current_user: User) -> bool:
    return current_user.is_admin is True or current_user.id == route.organizador_id

@router.put("/{ruta_publicada_id}", response_model=RutaPublicadaResponse)
def update_published_route(
    ruta_publicada_id: int,
    body: RutaPublicadaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
    db.refresh(route)
    return route

@router.delete("/{ruta_publicada_id}")
def unpublish_route(
    ruta_publicada_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    route = db.query(RutaPublicada).filter(RutaPublicada.id == ruta_publicada_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if not _can_edit_or_delete_published_route(route, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el organizador o un administrador pueden eliminar la ruta",
        )

    # Delete all attendees
    db.query(Asistente).filter(Asistente.ruta_publicada_id == ruta_publicada_id).delete()

    # Deactivate route
    route.is_active = False
    db.commit()
    return {"message": "Route unpublished"}
