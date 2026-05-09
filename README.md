# BCN Rockers — Rutas en moto

Aplicación para un club de moto: **catálogo de plantillas de ruta**, **calendario de salidas publicadas**, **grupos** con visibilidad y **asistentes**. El backend expone la API **KurveMaster** (FastAPI); el cliente es una SPA con React y Vite.

## Documentación detallada

- **[Roles, permisos y límites](docs/ROLES_Y_PERMISOS.md)** — qué puede hacer un administrador de la app, un usuario normal, un organizador de una salida, el creador de un grupo y un visitante sin cuenta.

## Características principales

- Calendario e histórico de salidas con filtros por zona (país, CCAA, provincia).
- Salidas **abiertas** o **de grupo** (solo visibles para miembros del grupo).
- Catálogo de plantillas reutilizables para publicar salidas; integración con enlaces de mapas y utilidades en `/maps`.
- Grupos: solicitudes de ingreso, miembros, logo, expulsiones (gestionado por el creador del grupo).
- Autenticación JWT; perfil de usuario y datos de moto opcionales.
- Fotos en salidas ya pasadas; subida servida bajo `/uploads`.

## Requisitos

- Python 3.10+ recomendado (3.8+ suele valer si las dependencias lo permiten).
- Node.js 18+ (o 16+ según tu entorno).
- SQLite por defecto si no defines `POSTGRES_URL` en `backend/.env`; para Postgres usa `POSTGRES_URL` (Render suele inyectar `DATABASE_URL`, también válido).

## Estructura del repositorio

```
bcnrockrsapp/
├── backend/          # FastAPI, SQLAlchemy, SQLite por defecto
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routes/   # auth, rutas, rutas_publicadas, grupos, maps
│   │   ├── models/
│   │   └── schemas/
│   └── requirements.txt
├── docs/
│   └── ROLES_Y_PERMISOS.md
├── frontend/         # React + Vite
└── README.md
```

## Puesta en marcha

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Crea backend/.env si no existe (ver tabla «Variables de entorno» más abajo)
python -m uvicorn app.main:app --reload --port 8002
```

API: `http://localhost:8002` — documentación interactiva: `http://localhost:8002/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL debe apuntar al backend
npm run dev
```

Cliente de desarrollo: `http://localhost:5173` (puerto por defecto de Vite).

## Variables de entorno (backend)

Fichero único `backend/.env` (no versionar). Pydantic Settings lee ese archivo y el proceso también acepta variables ya exportadas en el sistema (p. ej. `DATABASE_URL` en Render).

Obligatorias / habituales:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_URL` | URL de la base (en **backend/.env** usa siempre esta clave). También se acepta `DATABASE_URL` (p. ej. Render). SQLite local: `POSTGRES_URL=sqlite:///./rutas_moto.db`. |
| `SECRET_KEY` | Clave para firmar JWT; cambiar en producción. |
| `ALGORITHM` | Por defecto `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Caducidad del token (el login puede usar otra duración en código). |
| `DEBUG` | Modo depuración del servidor. |

Opcionales útiles:

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_MAPS_API_KEY` | Si usas funciones que dependen de la clave de Maps en backend. |
| `MAX_RUTAS_PLANTILLA_POR_USUARIO` | Tope de plantillas activas por usuario no admin (por defecto 10). |
| `MAX_PUBLICACIONES_SALIDA_POR_USUARIO_DIA` | Tope de salidas activas por día de salida y organizador para no admins; `0` = sin límite (por defecto 1). |
| `MAX_UPLOAD_MB` | Tamaño máximo de subida de imágenes. |
| `UPLOADS_DIR` | Directorio de ficheros subidos (fotos de salidas, logos de grupo). |

CORS incluye orígenes configurables y un patrón para red local / DynV6; revisa `backend/app/main.py` y `config.py` si despliegues en otro dominio.

## Frontend

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base del API (ej. `http://localhost:8002`). |

## Roles en una frase

Solo existe el flag **administrador global** (`is_admin`). El **organizador** de una salida es quien la publica; el **«admin del grupo»** es el **creador del grupo**, distinto del administrador del sitio. Detalle completo en [docs/ROLES_Y_PERMISOS.md](docs/ROLES_Y_PERMISOS.md).

## Despliegue

1. Define `SECRET_KEY` fuerte y, si aplica, HTTPS.
2. Ajusta `VITE_API_URL` al dominio público del API.
3. Abre CORS u orígenes según tu hosting.
4. Copia o monta `uploads/` si quieres persistir imágenes entre despliegues.

## Licencia y créditos

Proyecto privado para BCN Rockers.
.....