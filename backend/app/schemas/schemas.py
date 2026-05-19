import json

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Literal

# User schemas


def normalize_recorrido_geojson(v: Optional[str]) -> Optional[str]:
    """Valida y compacta un GeoJSON LineString (o Feature con LineString). Devuelve JSON str o None."""
    if v is None:
        return None
    if isinstance(v, str) and not v.strip():
        return None
    raw = v.strip() if isinstance(v, str) else v
    try:
        obj = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError as e:
        raise ValueError("recorrido_geojson debe ser JSON válido.") from e

    coords = None
    if isinstance(obj, dict):
        if obj.get("type") == "LineString":
            coords = obj.get("coordinates")
        elif obj.get("type") == "Feature":
            geom = obj.get("geometry") or {}
            if geom.get("type") == "LineString":
                coords = geom.get("coordinates")

    if not isinstance(coords, list) or len(coords) < 2:
        raise ValueError("La ruta debe tener al menos 2 puntos (GeoJSON LineString).")

    out_coords = []
    for c in coords:
        if not isinstance(c, (list, tuple)) or len(c) < 2:
            raise ValueError("Coordenadas inválidas en el recorrido.")
        lng, lat = float(c[0]), float(c[1])
        if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
            raise ValueError("Coordenadas fuera de rango (lng/lat).")
        out_coords.append([lng, lat])

    canonical = {"type": "LineString", "coordinates": out_coords}
    return json.dumps(canonical, separators=(",", ":"))


def osm_encuentro_url_desde_primer_punto(geojson_str: str) -> str:
    """Enlace abrible en navegador al primer punto del recorrido (mapa OSM)."""
    obj = json.loads(geojson_str)
    coords = obj.get("coordinates") or []
    if not coords:
        raise ValueError("Recorrido sin coordenadas.")
    lng, lat = float(coords[0][0]), float(coords[0][1])
    return (
        f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=15/{lat}/{lng}"
    )


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


class UserUpdateMe(BaseModel):
    """Actualización del perfil del usuario autenticado (sin usuario ni email)."""

    full_name: Optional[str] = None
    moto_marca: Optional[str] = None
    moto_modelo: Optional[str] = None
    moto_anio: Optional[int] = Field(None, ge=1950, le=2100)
    bio: Optional[str] = Field(None, max_length=600)

    @field_validator("full_name", "moto_marca", "moto_modelo", mode="before")
    @classmethod
    def strip_optional_strings(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("bio", mode="before")
    @classmethod
    def strip_bio(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    moto_marca: Optional[str] = None
    moto_modelo: Optional[str] = None
    moto_anio: Optional[int] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    moto_foto_1_url: Optional[str] = None
    moto_foto_2_url: Optional[str] = None
    moto_foto_3_url: Optional[str] = None
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserPublicProfileResponse(BaseModel):
    """Perfil visible por otros usuarios logueados (sin email ni datos sensibles)."""

    id: int
    username: str
    full_name: Optional[str] = None
    moto_marca: Optional[str] = None
    moto_modelo: Optional[str] = None
    moto_anio: Optional[int] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    moto_foto_1_url: Optional[str] = None
    moto_foto_2_url: Optional[str] = None
    moto_foto_3_url: Optional[str] = None

    class Config:
        from_attributes = True

# Ruta schemas
class RutaCreate(BaseModel):
    nombre: str
    link_ruta: str = ""
    link_encuentro: str = ""
    link_restaurante: Optional[str] = None
    fecha: Optional[str] = "Por definir"
    hora: Optional[str] = "Por confirmar"
    ubicacion_region: str = Field(..., min_length=2, max_length=16, description="Código CCAA")
    ubicacion_ciudad: str = Field(..., min_length=1, max_length=8, description="Código INE provincia")
    map_source: Literal["google", "osm"] = "google"
    recorrido_geojson: Optional[str] = None

    @field_validator("ubicacion_region", mode="before")
    @classmethod
    def strip_ccaa_catalogo(cls, v):
        s = str(v).strip().upper()
        if len(s) < 2:
            raise ValueError("Indica la comunidad autónoma.")
        return s[:16]

    @field_validator("ubicacion_ciudad", mode="before")
    @classmethod
    def norm_prov_catalogo(cls, v):
        s = str(v).strip()
        if not s.isdigit():
            raise ValueError("La provincia debe ser el código INE numérico (01–52).")
        return s.zfill(2)[:2]

    @model_validator(mode="after")
    def validate_google_vs_osm(self):
        if self.map_source == "google":
            lr = (self.link_ruta or "").strip()
            if not lr:
                raise ValueError("El enlace del recorrido (Google Maps) es obligatorio.")
            enc = (self.link_encuentro or "").strip()
            if not enc:
                raise ValueError("El punto de encuentro (enlace) es obligatorio.")
            return self.model_copy(
                update={"link_ruta": lr, "recorrido_geojson": None, "link_encuentro": enc}
            )
        geo = normalize_recorrido_geojson(self.recorrido_geojson)
        if not geo:
            raise ValueError(
                "Para rutas en mapa abierto, dibuja o importa un recorrido con al menos 2 puntos."
            )
        enc = (self.link_encuentro or "").strip()
        if not enc:
            enc = osm_encuentro_url_desde_primer_punto(geo)
        return self.model_copy(
            update={"link_ruta": "", "recorrido_geojson": geo, "link_encuentro": enc}
        )


class RutaUpdate(BaseModel):
    nombre: Optional[str] = None
    link_ruta: Optional[str] = None
    link_encuentro: Optional[str] = None
    link_restaurante: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    ubicacion_region: Optional[str] = Field(None, max_length=16)
    ubicacion_ciudad: Optional[str] = Field(None, max_length=8)
    map_source: Optional[Literal["google", "osm"]] = None
    recorrido_geojson: Optional[str] = None

    @field_validator("ubicacion_region", mode="before")
    @classmethod
    def strip_ccaa_catalogo_opt(cls, v):
        if v is None:
            return None
        s = str(v).strip().upper()
        return s[:16] if s else None

    @field_validator("ubicacion_ciudad", mode="before")
    @classmethod
    def norm_prov_catalogo_opt(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        if not s.isdigit():
            raise ValueError("La provincia debe ser el código INE numérico (01–52).")
        return s.zfill(2)[:2]


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
    embed_recorrido_url: Optional[str] = None
    ubicacion_region: Optional[str] = None
    ubicacion_ciudad: Optional[str] = None
    marcada_eliminacion: bool = False
    map_source: str = "google"
    recorrido_geojson: Optional[str] = None

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


class GrupoCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=80)

    @field_validator("nombre", mode="before")
    @classmethod
    def strip_nombre(cls, v):
        if v is None:
            return v
        return str(v).strip()


class GrupoResponse(BaseModel):
    id: int
    nombre: str
    creador_id: int
    created_at: datetime
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


class GrupoListaItem(BaseModel):
    """Listado público de grupos con recuento de miembros."""

    id: int
    nombre: str
    creador_id: int
    created_at: datetime
    num_miembros: int
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


class GrupoMiembroItem(BaseModel):
    user_id: int
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class GrupoSolicitudPendienteItem(BaseModel):
    user_id: int
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GrupoDetalleResponse(BaseModel):
    id: int
    nombre: str
    creador_id: int
    eres_miembro: bool
    eres_creador: bool
    solicitud_pendiente_tuya: bool
    num_miembros: int
    logo_url: Optional[str] = None
    miembros: List[GrupoMiembroItem]
    solicitudes_pendientes: List[GrupoSolicitudPendienteItem]


class GrupoSnippet(BaseModel):
    id: int
    nombre: str
    creador_id: int

    class Config:
        from_attributes = True


# RutaPublicada schemas
class RutaPublicadaCreate(BaseModel):
    ruta_id: int
    dia_ruta: str
    hora_ruta: str
    link_encuentro_personalizado: Optional[str] = None
    link_restaurante_personalizado: Optional[str] = None
    ubicacion_pais: Literal["ES"] = "ES"
    ubicacion_region: Optional[str] = Field(None, max_length=16)
    ubicacion_ciudad: Optional[str] = Field(None, max_length=8)
    visibilidad: Literal["abierta", "grupo"] = "abierta"
    grupo_id: Optional[int] = None

    @model_validator(mode="after")
    def validar_grupo_salida(self):
        if self.visibilidad == "abierta":
            return self.model_copy(update={"grupo_id": None})
        if not self.grupo_id:
            raise ValueError("Para una salida de grupo debes indicar grupo_id.")
        return self

    @field_validator("ubicacion_pais", mode="before")
    @classmethod
    def solo_espana(cls, v):
        return "ES"

    @field_validator("ubicacion_region", "ubicacion_ciudad", mode="before")
    @classmethod
    def strip_optional_location(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None


class RutaPublicadaUpdate(BaseModel):
    """Campos opcionales; null en link_encuentro_personalizado quita el enlace personalizado."""
    dia_ruta: Optional[str] = None
    hora_ruta: Optional[str] = None
    link_encuentro_personalizado: Optional[str] = None
    ubicacion_pais: Optional[Literal["ES"]] = None
    ubicacion_region: Optional[str] = Field(None, max_length=16)
    ubicacion_ciudad: Optional[str] = Field(None, max_length=8)
    visibilidad: Optional[Literal["abierta", "grupo"]] = None
    grupo_id: Optional[int] = None

    @field_validator("ubicacion_pais", mode="before")
    @classmethod
    def solo_espana_opt(cls, v):
        if v is None:
            return None
        s = str(v).strip().upper()
        if s != "ES":
            raise ValueError("De momento solo se admite España (ES).")
        return "ES"

    @field_validator("ubicacion_region", "ubicacion_ciudad", mode="before")
    @classmethod
    def strip_optional_location_update(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None


class RutaPublicadaResponse(BaseModel):
    id: int
    ruta_id: int
    organizador_id: int
    dia_ruta: str
    hora_ruta: str
    link_encuentro_personalizado: Optional[str]
    link_restaurante_personalizado: Optional[str]
    ubicacion_pais: str
    ubicacion_region: Optional[str]
    ubicacion_ciudad: Optional[str]
    visibilidad: str
    grupo_id: Optional[int] = None
    grupo: Optional[GrupoSnippet] = None
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
