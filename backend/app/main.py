from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routes import auth_router, rutas_router, rutas_publicadas_router
from app.routes.maps import router as maps_router

app = FastAPI(title=settings.app_name, debug=settings.debug)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
