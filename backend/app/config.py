from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./rutas_moto.db"
    
    # JWT
    secret_key: str = "tu-clave-secreta-cambiar-en-produccion"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    cors_origins: list = [
        "http://localhost:3000",
        "http://localhost:8000",
        "https://hexen88.dynv6.net:3000",
        "https://hexen88.dynv6.net:8001",
        "http://hexen88.dynv6.net:3000",
        "http://hexen88.dynv6.net:8001"
    ]
    
    # App
    app_name: str = "BCN Rockers Routes API"
    debug: bool = True

    # Google Maps
    google_maps_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
