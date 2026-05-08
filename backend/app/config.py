from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

_BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Orígenes CORS por defecto (local + LAN). En producción añade tu dominio
# de Vercel/frontend via la variable de entorno CORS_ORIGINS (separados por coma).
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:8002",
    "http://192.168.1.41:3001",
    "https://hexen88.dynv6.net:3000",
    "https://hexen88.dynv6.net:8002",
    "http://hexen88.dynv6.net:3000",
    "http://hexen88.dynv6.net:8002",
]


def _parse_cors(raw: str) -> List[str]:
    """Parsea CORS_ORIGINS desde string separado por comas."""
    parsed = [o.strip() for o in raw.split(",") if o.strip()]
    return parsed if parsed else _DEFAULT_CORS_ORIGINS


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
    )

    # Database - defaults to SQLite for backward compatibility
    # Use environment variable DATABASE_URL to override (e.g., postgresql://user:pass@host/db)
    database_url: str = "sqlite:///./rutas_moto.db"

    # JWT
    secret_key: str = "tu-clave-secreta-cambiar-en-produccion"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS
    # Sobreescribe con CORS_ORIGINS=https://tu-app.vercel.app,https://otro.com
    # Si está vacío o no definido, se usan los orígenes por defecto (_DEFAULT_CORS_ORIGINS).
    # Se almacena como str para evitar que pydantic-settings intente parsear JSON.
    cors_origins_raw: str = Field(default="", alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> List[str]:
        if self.cors_origins_raw.strip():
            return _parse_cors(self.cors_origins_raw)
        return _DEFAULT_CORS_ORIGINS

    # App
    app_name: str = "KurveMaster API"
    debug: bool = False

    # Google Maps
    google_maps_api_key: str = ""

    # Subidas (fotos de rutas pasadas)
    uploads_dir: str = str(_BACKEND_ROOT / "uploads")
    max_upload_mb: int = 8

    # Plantillas de ruta en catálogo (POST /rutas) por usuario no administrador
    max_rutas_plantilla_por_usuario: int = 10

    # Salidas publicadas activas por día y usuario (POST /rutas-publicadas); 0 = sin límite
    max_publicaciones_salida_por_usuario_dia: int = 1


settings = Settings()
