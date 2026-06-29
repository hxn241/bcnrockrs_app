# Guía de Deploy — KurveMaster

## 1. Desarrollo local con Docker

### Requisitos
- Docker + Docker Compose instalados

### Arrancar todo (Postgres + Backend + Frontend)

```bash
docker-compose up --build
```

| Servicio   | URL                        |
|------------|----------------------------|
| Frontend   | http://localhost:3000       |
| Backend    | http://localhost:8002       |
| API Docs   | http://localhost:8002/docs  |
| PostgreSQL | localhost:5432              |

### Variables de entorno en local (Docker)

No necesitas crear ningún archivo `.env` para el modo Docker. Los valores por defecto del `docker-compose.yml` son suficientes para desarrollo local.

Si quieres sobreescribir algún valor, crea un archivo `.env` en la raíz del proyecto (junto a `docker-compose.yml`):

```env
# .env (raíz del proyecto, solo para docker-compose)
SECRET_KEY=mi-clave-local-segura
DEBUG=True
# CORS_ORIGINS=   ← déjalo vacío en local
# VITE_API_URL=   ← déjalo vacío en local (usa http://localhost:8002 por defecto)
```

---

## 2. Deploy en producción: Render (backend) + Vercel (frontend)

### 2.1 Render — Backend FastAPI + PostgreSQL

#### Paso 1: Crear base de datos PostgreSQL en Render
1. En el dashboard de Render → **New → PostgreSQL**
2. Elige nombre, región y plan (Free tier disponible)
3. Copia la **Internal Database URL** (la usarás en el siguiente paso)

#### Paso 2: Crear servicio Web para el backend
1. **New → Web Service** → conecta tu repositorio GitHub
2. Configuración:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### Paso 3: Variables de entorno en Render (backend)

| Variable | Valor |
|----------|-------|
| `APP_ENV` | `prod` (activa los defaults de producción: DEBUG=False y CORS de prod) |
| `DATABASE_URL` | La Internal Database URL de tu PostgreSQL en Render |
| `SECRET_KEY` | Una clave aleatoria larga (ver abajo cómo generarla) |
| `CORS_ORIGINS` | `https://tu-app.vercel.app` (tu frontend en Vercel; sobreescribe el default de `APP_ENV`) |
| `GOOGLE_MAPS_API_KEY` | Tu clave de Google Maps (si la usas) |

> **Generar SECRET_KEY segura:**
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

### 2.2 Vercel — Frontend React/Vite

#### Paso 1: Importar proyecto
1. En Vercel → **Add New Project** → importa tu repositorio
2. **Framework Preset**: Vite
3. **Root Directory**: `frontend`

#### Paso 2: Variables de entorno en Vercel

| Variable | Valor |
|----------|-------|
| `VITE_APP_ENV` | `prod` (usa la URL de backend de producción definida en `apiBaseUrl.js`) |
| `VITE_API_URL` | *(opcional)* `https://tu-backend.onrender.com` para forzar una URL exacta (gana al flag) |

#### Paso 3: Deploy
Vercel desplegará automáticamente en cada push a `main`.

---

## 3. Resumen de variables de entorno

> El flag `APP_ENV` / `VITE_APP_ENV` (`local` | `prod`) selecciona los defaults.
> Las variables explícitas (`DATABASE_URL`, `CORS_ORIGINS`, `DEBUG`, `VITE_API_URL`) siempre ganan al flag.

### Backend (`backend/.env` o env vars en Render)

| Variable | Local Docker | Producción (Render) |
|----------|-------------|---------------------|
| `APP_ENV` | `local` | `prod` |
| `DATABASE_URL` | `postgresql://bcnrockers:bcnrockers_password@postgres:5432/bcnrockers_db` *(lo pasa docker-compose)* | Internal URL de Render PostgreSQL |
| `SECRET_KEY` | cualquier valor | **clave aleatoria segura** |
| `DEBUG` | *(default del flag: `True`)* | *(default del flag: `False`)* |
| `CORS_ORIGINS` | *(vacío — usa defaults)* | `https://tu-app.vercel.app` |
| `GOOGLE_MAPS_API_KEY` | *(opcional)* | Tu clave de Google Maps |

### Frontend (`frontend/.env` o env vars en Vercel)

| Variable | Local Docker | Producción (Vercel) |
|----------|-------------|---------------------|
| `VITE_APP_ENV` | `local` | `prod` |
| `VITE_API_URL` | *(default del flag: `http://localhost:8002`)* | *(default del flag: `https://tu-backend.onrender.com`)* |

---

## 4. Primer arranque en producción — migraciones

Tras el primer deploy en Render, las tablas se crean automáticamente al arrancar el backend (via `init_db()` en startup). No necesitas ejecutar migraciones manualmente.

Si tienes datos en SQLite local que quieres migrar a PostgreSQL, usa:

```bash
cd backend
python migrate_sqlite_to_postgres.py
```
