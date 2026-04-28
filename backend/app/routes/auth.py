from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, UserLogin
from app.auth import hash_password, verify_password, create_access_token
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

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

    # Check if this is the first user (make them admin)
    user_count = db.query(User).count()
    is_admin = user_count == 0

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
        "user": UserResponse.from_orm(db_user)
    }
