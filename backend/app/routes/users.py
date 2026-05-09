from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import UserPublicProfileResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/perfil", response_model=UserPublicProfileResponse)
def perfil_publico(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Perfil de otro usuario (requiere sesión). Sin email ni datos internos."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserPublicProfileResponse.model_validate(u)
