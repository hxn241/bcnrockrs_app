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
| `CORS_ORIGINS` | Orígenes permitidos del frontend (ver siguiente apartado). |
| `GOOGLE_MAPS_API_KEY` | Tu clave de Google Maps (solo si usas recorridos con enlace/embed de Google Maps). |

##### CORS con Vercel (producción + dominio propio)

El backend ya permite por regex cualquier origen `https://*.vercel.app` (incluye previews de PR).

Si tu frontend público es solo la URL por defecto de Vercel, puedes dejar `CORS_ORIGINS` vacío y seguirá funcionando gracias a esa regex — o definir explícitamente, por ejemplo:

`CORS_ORIGINS=https://tu-app.vercel.app`

Si usas **dominio personalizado** en Vercel (`https://rutas.tudominio.com`), la regex de `*.vercel.app` **no** lo cubre: añádelo en `CORS_ORIGINS` (varios separados por coma, sin espacios problemáticos):

`CORS_ORIGINS=https://tu-app.vercel.app,https://rutas.tudominio.com`

Tras cambiar CORS en Render, **redeploy** del servicio web.

##### Mapas abiertos (Leaflet + OSM) y este repo

No necesitas API key en Render ni en Vercel para el mapa OSM: el navegador pide las teselas a los servidores de OpenStreetMap. El backend solo guarda el GeoJSON de la ruta en la base de datos (columnas añadidas en `init_db()` al arrancar).

Sigue siendo obligatorio que el frontend en Vercel tenga **`VITE_API_URL`** apuntando a tu API en Render para login, rutas, fotos y subidas.

La **búsqueda de lugares** en el creador de rutas usa **`GET /maps/geocode`**, que en Render consulta [Nominatim](https://nominatim.openstreetmap.org/) (salida HTTPS desde tu backend). Sin API key; [política de uso](https://operations.osmfoundation.org/policies/nominatim/) — conviene no automatizar muchas búsquedas seguidas.

**Routing por carretera:** **`POST /maps/route-osrm`** llama a un servidor [OSRM](http://project-osrm.org/). **`POST /maps/route-osrm-guidance`** usa OSRM con pasos (`steps=true`). **`POST /maps/route-guidance`** es el endpoint que usa la app para navegación: si defines **`VALHALLA_BASE_URL`**, intenta [Valhalla](https://valhalla.github.io/valhalla/) primero (maniobras en español vía `VALHALLA_GUIDANCE_LANGUAGE`); si Valhalla falla o no está configurado, cae en OSRM. Por defecto el demo OSRM `https://router.project-osrm.org` puede saturarse; para producción configura tus propios servicios. Para levantar Valhalla en local con Docker, sigue **[VALHALLA.md](VALHALLA.md)** (perfil `valhalla`).

| Variable | Descripción |
|----------|-------------|
| `OSRM_BASE_URL` | URL base de tu instancia OSRM (sin barra final), p. ej. `https://router.tudominio.com` |
| `OSRM_PROFILE` | Perfil de enrutado OSRM (por defecto `driving`). |
| `VALHALLA_BASE_URL` | *(Opcional)* URL base de Valhalla (sin barra final). En Render suele ser **`https://tu-valhalla.dominio.com`** (Valhalla en VPS/proxy). Vacío = solo OSRM en `/maps/route-guidance`. |
| `VALHALLA_COSTING` | Costing Valhalla (por defecto `motorcycle`; si falla, el backend prueba `auto`). |
| `VALHALLA_GUIDANCE_LANGUAGE` | Etiqueta BCP 47 para narraciones (por defecto `es-ES`). |

El backend debe poder hacer peticiones **salientes** a esa URL (HTTPS recomendado).

##### Navegación «Iniciar navegación» + Valhalla

- La pantalla de navegación solo aplica a salidas cuya plantilla tiene **recorrido en mapa abierto**: **`map_source` = OSM** y **`recorrido_geojson`** relleno. Las rutas «solo Google» no entran en ese flujo.
- Configura **`VALHALLA_BASE_URL`** en Render como una URL pública donde sirvas Valhalla (normalmente un **VPS + Docker**; hay ejemplo en **[deploy/valhalla-standalone/README.md](../deploy/valhalla-standalone/README.md)**).
- Guía detallada (checklist, pruebas, HTTPS): **[VALHALLA.md](VALHALLA.md)** § 4.

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
| `VITE_API_URL` | `https://tu-backend.onrender.com` (URL **HTTPS** pública del Web Service en Render, **sin** barra final; es la misma que pruebas en `/docs`) |

No hace falta ninguna variable extra para Leaflet/OSM: las teselas se cargan desde el navegador del usuario.

Tras crear o cambiar `VITE_API_URL`, haz un **nuevo deploy** en Vercel (el valor se inyecta en build time en Vite).

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
| `CORS_ORIGINS` | *(vacío — usa defaults + regex `*.vercel.app`)* | Vacío si solo usas `*.vercel.app`; si tienes **dominio propio** en Vercel, lista HTTPS separada por comas |
| `GOOGLE_MAPS_API_KEY` | *(opcional)* | Tu clave de Google Maps |
| `OSRM_BASE_URL` | por defecto demo OSRM | Tu servidor OSRM en producción (recomendado) |
| `OSRM_PROFILE` | `driving` | `driving`, `walking`, `cycling`, según tu instalación OSRM |
| `VALHALLA_BASE_URL` | *(vacío)* | URL **`https://…`** de tu Valhalla en VPS/proxy (sin `/` final); ver [deploy/valhalla-standalone](../deploy/valhalla-standalone/README.md) |
| `VALHALLA_COSTING` | `motorcycle` | `motorcycle`, `auto`, etc., según tu grafo Valhalla |
| `VALHALLA_GUIDANCE_LANGUAGE` | `es-ES` | Idioma de las instrucciones devueltas por Valhalla |

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
