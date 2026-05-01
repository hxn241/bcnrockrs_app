from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# User schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    moto_marca: Optional[str] = None
    moto_modelo: Optional[str] = None
    moto_anio: Optional[int] = Field(None, ge=1950, le=2100)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    moto_marca: Optional[str] = None
    moto_modelo: Optional[str] = None
    moto_anio: Optional[int] = None
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Ruta schemas
class RutaCreate(BaseModel):
    nombre: str
    link_ruta: str
    link_encuentro: str
    link_restaurante: Optional[str] = None
    fecha: Optional[str] = "Por definir"
    hora: Optional[str] = "Por confirmar"

class RutaUpdate(BaseModel):
    nombre: Optional[str] = None
    link_ruta: Optional[str] = None
    link_encuentro: Optional[str] = None
    link_restaurante: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None

class RutaResponse(BaseModel):
    id: int
    nombre: str
    link_ruta: str
    link_encuentro: str
    link_restaurante: Optional[str]
    fecha: str
    hora: str
    created_at: datetime
    creador_id: Optional[int] = None

    class Config:
        from_attributes = True


class RutaPublicadaFotoResponse(BaseModel):
    id: int
    ruta_publicada_id: int
    user_id: int
    url: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# RutaPublicada schemas
class RutaPublicadaCreate(BaseModel):
    ruta_id: int
    dia_ruta: str
    hora_ruta: str
    link_encuentro_personalizado: Optional[str] = None
    link_restaurante_personalizado: Optional[str] = None

class RutaPublicadaUpdate(BaseModel):
    """Campos opcionales; null en link_encuentro_personalizado quita el enlace personalizado."""
    dia_ruta: Optional[str] = None
    hora_ruta: Optional[str] = None
    link_encuentro_personalizado: Optional[str] = None

class RutaPublicadaResponse(BaseModel):
    id: int
    ruta_id: int
    organizador_id: int
    dia_ruta: str
    hora_ruta: str
    link_encuentro_personalizado: Optional[str]
    link_restaurante_personalizado: Optional[str]
    is_active: bool
    created_at: datetime
    ruta: RutaResponse
    organizador: Optional['UserResponse'] = None
    asistentes: List['AsistenteResponse'] = []
    
    class Config:
        from_attributes = True

# Asistente schemas
class AsistenteResponse(BaseModel):
    id: int
    user_id: int
    ruta_publicada_id: int
    created_at: datetime
    user: Optional['UserResponse'] = None

    class Config:
        from_attributes = True
