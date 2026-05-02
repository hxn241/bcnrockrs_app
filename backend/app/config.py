from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Database - uses DATABASE_URL env var (Neon PostgreSQL)
    database_url: str = ""
    
    # JWT
    secret_key: str = "tu-clave-secreta-cambiar-en-produccion"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    cors_origins: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8002",
        "http://192.168.1.41:3001",
        "https://hexen88.dynv6.net:3000",
        "https://hexen88.dynv6.net:8002",
        "http://hexen88.dynv6.net:3000",
        "http://hexen88.dynv6.net:8002"
    ]
    
    # App
    app_name: str = "KurveMaster API"
    debug: bool = True

    # Google Maps
    google_maps_api_key: str = ""

    # Subidas (fotos de rutas pasadas)
    uploads_dir: str = str(_BACKEND_ROOT / "uploads")
    max_upload_mb: int = 8

    class Config:
        env_file = ".env"

settings = Settings()
