import pathlib
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, UserLogin, UserUpdateMe
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.config import settings
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

_ALLOWED_IMAGE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _uploads_root() -> pathlib.Path:
    return pathlib.Path(settings.uploads_dir)


def _user_avatar_dir(user_id: int) -> pathlib.Path:
    return _uploads_root() / "user_avatars" / str(user_id)


def _user_moto_foto_dir(user_id: int) -> pathlib.Path:
    return _uploads_root() / "user_moto_fotos" / str(user_id)


def _remove_avatar_file(user: User) -> None:
    fn = getattr(user, "avatar_filename", None)
    if not fn:
        return
    p = _user_avatar_dir(user.id) / fn
    if p.is_file():
        p.unlink()


def _remove_moto_foto_at_slot(user: User, slot: int) -> None:
    attr = f"moto_foto_{slot}_filename"
    fn = getattr(user, attr, None)
    if not fn:
        return
    p = _user_moto_foto_dir(user.id) / fn
    if p.is_file():
        p.unlink()


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdateMe,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(current_user, key, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


async def _read_upload_image(file: UploadFile) -> tuple[str, bytes]:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    ext = _ALLOWED_IMAGE.get(ct)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no permitido. Usa JPEG, PNG o WebP.",
        )
    data = await file.read()
    max_bytes = max(1, settings.max_upload_mb) * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Imagen demasiado grande (máx. {settings.max_upload_mb} MB).",
        )
    return ext, data


@router.post("/me/avatar", response_model=UserResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext, data = await _read_upload_image(file)

    _remove_avatar_file(current_user)
    fname = f"{uuid4().hex}{ext}"
    dest_dir = _user_avatar_dir(current_user.id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / fname).write_bytes(data)

    current_user.avatar_filename = fname
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
def delete_my_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _remove_avatar_file(current_user)
    current_user.avatar_filename = None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/moto-fotos/{slot}", response_model=UserResponse)
async def upload_my_moto_foto(
    slot: Annotated[int, Path(ge=1, le=3)],
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext, data = await _read_upload_image(file)
    attr = f"moto_foto_{slot}_filename"
    _remove_moto_foto_at_slot(current_user, slot)
    fname = f"{uuid4().hex}{ext}"
    dest_dir = _user_moto_foto_dir(current_user.id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / fname).write_bytes(data)
    setattr(current_user, attr, fname)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/moto-fotos/{slot}", response_model=UserResponse)
def delete_my_moto_foto(
    slot: Annotated[int, Path(ge=1, le=3)],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attr = f"moto_foto_{slot}_filename"
    _remove_moto_foto_at_slot(current_user, slot)
    setattr(current_user, attr, None)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )

    # Los administradores solo vía herramientas de gestión (p. ej. manage_users.py); el registro web crea usuarios normales.
    is_admin = False

    # Create new user
    hashed_password = hash_password(user.password)
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        moto_marca=(user.moto_marca.strip() if user.moto_marca else None) or None,
        moto_modelo=(user.moto_modelo.strip() if user.moto_modelo else None) or None,
        moto_anio=user.moto_anio,
        is_admin=is_admin
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    # Find user
    db_user = db.query(User).filter(User.username == user.username).first()
    
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create token
    access_token_expires = timedelta(minutes=480)
    access_token = create_access_token(
        data={"sub": db_user.id},
        expires_delta=access_token_expires
    )

    return {
        "access_token": str(access_token) if not isinstance(access_token, str) else access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(db_user)
    }
