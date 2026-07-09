from pathlib import Path
from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

_BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Clave por defecto (solo válida en local). En prod se rechaza al arrancar.
_DEFAULT_SECRET_KEY = "tu-clave-secreta-cambiar-en-produccion"

# Placeholders conocidos e inseguros (config.py y docker-compose.yml). Ninguno
# puede usarse en producción: son públicos y están en el repositorio.
_INSECURE_SECRET_KEYS = {
    _DEFAULT_SECRET_KEY,
    "tu-clave-super-segura-cambiar-en-produccion",
}

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

# Orígenes CORS de producción. PLACEHOLDER: reemplaza por tu dominio real de Vercel.
_PROD_CORS_ORIGINS = [
    "https://tu-app.vercel.app",
]

# Postgres local (Docker). El contenedor expone el puerto 5432 en localhost.
# Dentro de la red de docker-compose el host es "postgres" y el propio
# docker-compose.yml ya pasa su DATABASE_URL explícito (que tiene prioridad).
_LOCAL_DATABASE_URL = "postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db"

# Valores por defecto según el flag APP_ENV. Cualquier variable explícita
# (DATABASE_URL, CORS_ORIGINS, DEBUG) tiene prioridad sobre estos defaults.
_ENV_DEFAULTS = {
    "local": {
        # Modo local = Docker con PostgreSQL levantado (no SQLite).
        "database_url": _LOCAL_DATABASE_URL,
        "debug": True,
        "cors_origins": _DEFAULT_CORS_ORIGINS,
    },
    "prod": {
        # En producción la base de datos la inyecta Render via DATABASE_URL.
        "database_url": "",
        "debug": False,
        "cors_origins": _PROD_CORS_ORIGINS,
    },
}


def _parse_cors(raw: str) -> List[str]:
    """Parsea CORS_ORIGINS desde string separado por comas."""
    parsed = [o.strip() for o in raw.split(",") if o.strip()]
    return parsed if parsed else _DEFAULT_CORS_ORIGINS


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore",  # ignora env vars no reconocidas (p. ej. POSTGRES_URL)
    )

    # ──────────────────────────────────────────────
    # Flag principal: "local" o "prod".
    # Selecciona los valores por defecto de base de datos, CORS y DEBUG.
    # Las variables explícitas (DATABASE_URL, CORS_ORIGINS, DEBUG) lo sobreescriben.
    # ──────────────────────────────────────────────
    app_env: str = Field(default="local", alias="APP_ENV")

    # Database — si DATABASE_URL no se define, se usa el default de APP_ENV.
    database_url_raw: str = Field(default="", alias="DATABASE_URL")

    # JWT
    secret_key: str = _DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS — si CORS_ORIGINS no se define, se usa el default de APP_ENV.
    # Se almacena como str para evitar que pydantic-settings intente parsear JSON.
    cors_origins_raw: str = Field(default="", alias="CORS_ORIGINS")

    # DEBUG — si no se define, se usa el default de APP_ENV (local=True, prod=False).
    debug_raw: Optional[bool] = Field(default=None, alias="DEBUG")

    @property
    def _env_defaults(self) -> dict:
        return _ENV_DEFAULTS.get(self.app_env.strip().lower(), _ENV_DEFAULTS["local"])

    @computed_field
    @property
    def database_url(self) -> str:
        if self.database_url_raw.strip():
            return self.database_url_raw.strip()
        return self._env_defaults["database_url"]

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        if self.cors_origins_raw.strip():
            return _parse_cors(self.cors_origins_raw)
        return self._env_defaults["cors_origins"]

    @computed_field
    @property
    def debug(self) -> bool:
        if self.debug_raw is not None:
            return self.debug_raw
        return self._env_defaults["debug"]

    @model_validator(mode="after")
    def _validar_secret_en_prod(self):
        # En producción no se permite arrancar con la SECRET_KEY por defecto
        # del repositorio: firmaría JWT con una clave pública y conocida.
        if self.app_env.strip().lower() == "prod" and self.secret_key in _INSECURE_SECRET_KEYS:
            raise ValueError(
                "Define una SECRET_KEY propia en producción (APP_ENV=prod). "
                'Genera una con: python -c "import secrets; print(secrets.token_hex(32))"'
            )
        return self

    # App
    app_name: str = "KurveMaster API"

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
