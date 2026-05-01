from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routes import auth_router, rutas_router, rutas_publicadas_router
from app.routes.maps import router as maps_router

app = FastAPI(title=settings.app_name, debug=settings.debug)

# CORS: orígenes fijos + regex para móvil/LAN (192.168.x, 10.x, 172.16–31.x) y túnel DynV6
_CORS_LAN_DYNV6 = (
    r"^https?://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}"
    r"|hexen88\.dynv6\.net)(:\d+)?$"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=_CORS_LAN_DYNV6,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
@app.on_event("startup")
def startup():
    init_db()

# Include routers
app.include_router(auth_router)
app.include_router(rutas_router)
app.include_router(rutas_publicadas_router)
app.include_router(maps_router)

_upload_dir = Path(settings.uploads_dir)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to BCN Rockers Routes API",
        "docs": "/docs",
        "api": {
            "auth": "/auth",
            "rutas": "/rutas",
            "rutas_publicadas": "/rutas-publicadas"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
