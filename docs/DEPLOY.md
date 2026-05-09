# Guía de Deploy — KurveMaster

## 1. Desarrollo local con Docker (recomendado)

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

## 2. Desarrollo local SIN Docker (`start-dev.sh`)

### Requisitos
- Python 3.11+ con venv creado en `backend/venv`
- Node.js 18+
- PostgreSQL corriendo (nativo o `docker-compose up postgres`)

### Configurar el backend

Crea `backend/.env` con al menos `POSTGRES_URL` (o `DATABASE_URL`), `SECRET_KEY` y el resto según [README](../README.md#variables-de-entorno-backend). El script `setup.sh` genera un `.env` mínimo si no existe.

### Arrancar

```bash
./start-dev.sh
```

Abre dos terminales: una para el backend (puerto 8002) y otra para el frontend (puerto 3001).

---

## 3. Deploy en producción: Render (backend) + Vercel (frontend)

### 3.1 Render — Backend FastAPI + PostgreSQL

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
| `DATABASE_URL` | Suele **rellenarse sola** al enlazar Postgres en Render (Internal Database URL). |
| `POSTGRES_URL` | En **backend/.env** local siempre esta clave; en Render es opcional (misma URL que Postgres si prefieres unificar nombres). |
| `SECRET_KEY` | Una clave aleatoria larga (ver abajo cómo generarla) |
| `DEBUG` | `False` |
| `CORS_ORIGINS` | `https://tu-app.vercel.app` (la URL de tu frontend en Vercel) |
| `GOOGLE_MAPS_API_KEY` | Tu clave de Google Maps (si la usas) |

> **Generar SECRET_KEY segura:**
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

### 3.2 Vercel — Frontend React/Vite

#### Paso 1: Importar proyecto
1. En Vercel → **Add New Project** → importa tu repositorio
2. **Framework Preset**: Vite
3. **Root Directory**: `frontend`

#### Paso 2: Variables de entorno en Vercel

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://tu-backend.onrender.com` (la URL pública de tu backend en Render) |

#### Paso 3: Deploy
Vercel desplegará automáticamente en cada push a `main`.

---

## 4. Resumen de variables de entorno

### Backend (`backend/.env` o env vars en Render)

| Variable | Local Docker | Producción (Render) |
|----------|-------------|---------------------|
| `POSTGRES_URL` | `docker-compose` (backend) y **backend/.env** en local | Misma internal URL del Postgres (opcional) |
| `DATABASE_URL` | *No usar en .env local; preferir `POSTGRES_URL`* | Suele crearla Render al enlazar Postgres; equivalente a `POSTGRES_URL` |
| `SECRET_KEY` | cualquier valor | **clave aleatoria segura** |
| `DEBUG` | `True` | `False` |
| `CORS_ORIGINS` | *(vacío — usa defaults)* | `https://tu-app.vercel.app` |
| `GOOGLE_MAPS_API_KEY` | *(opcional)* | Tu clave de Google Maps |

### Frontend (`frontend/.env` o env vars en Vercel)

| Variable | Local Docker | Producción (Vercel) |
|----------|-------------|---------------------|
| `VITE_API_URL` | `http://localhost:8002` | `https://tu-backend.onrender.com` |

---

## 5. Primer arranque en producción — migraciones

Tras el primer deploy en Render, las tablas se crean automáticamente al arrancar el backend (via `init_db()` en startup). No necesitas ejecutar migraciones manualmente.

Si tienes datos en SQLite local que quieres migrar a PostgreSQL, usa:

```bash
cd backend
python migrate_sqlite_to_postgres.py
```
