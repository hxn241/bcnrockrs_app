# Configuración de PostgreSQL

## Resumen

La aplicación usa **PostgreSQL** como base de datos. SQLite solo se usaba en desarrollo local y ya no es necesario.

---

## Arquitectura de despliegue

| Componente | Plataforma | Notas |
|---|---|---|
| Frontend | Vercel | React + Vite |
| Backend (API) | Render | FastAPI + Python |
| Base de datos | Render Postgres / Supabase / Railway | PostgreSQL 15+ |

---

## Variables de entorno del backend

El backend lee la configuración desde variables de entorno (o archivo `.env`):

```env
# En backend/.env usa siempre POSTGRES_URL para la URL de la base.
POSTGRES_URL=postgresql://usuario:contraseña@host:5432/nombre_db

# JWT
SECRET_KEY=clave-super-secreta-minimo-32-caracteres
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Opcional
DEBUG=False
GOOGLE_MAPS_API_KEY=tu-api-key
MAX_UPLOAD_MB=8
```

### Formato de POSTGRES_URL

```
postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/NOMBRE_DB
```

Ejemplos por proveedor:

| Proveedor | Ejemplo URL |
|---|---|
| **Render** | `postgresql://user:pass@dpg-xxx.oregon-postgres.render.com/bcnrockers_db` |
| **Supabase** | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| **Railway** | `postgresql://postgres:pass@containers-us-west-xxx.railway.app:5432/railway` |
| **Docker local** | `postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db` |

---

## Desarrollo local con Docker

### Arrancar solo PostgreSQL

```bash
docker compose up -d postgres
```

### Arrancar todo (PostgreSQL + backend + frontend)

```bash
docker compose up -d
```

### Verificar que PostgreSQL está listo

```bash
docker compose exec postgres pg_isready -U bcnrockers
```

### Conectarse a la base de datos

```bash
docker compose exec postgres psql -U bcnrockers -d bcnrockers_db
```

---

## Migración desde SQLite

Si tienes datos en el archivo `rutas_moto.db` (SQLite), usa el script de migración:

### 1. Asegúrate de que PostgreSQL está corriendo

```bash
docker compose up -d postgres
```

### 2. Ejecuta el script de migración

La URL de PostgreSQL puede ir en `backend/.env` como `POSTGRES_URL` o `DATABASE_URL` (como la API); si no pasas `--postgres`, el script la lee de ahí.

```bash
# Desde el directorio raíz del proyecto
backend/venv/bin/python backend/migrate_sqlite_to_postgres.py \
  --sqlite "sqlite:///./backend/rutas_moto.db" \
  --postgres "postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db"
```

O con variables de entorno:

```bash
SQLITE_URL="sqlite:///./backend/rutas_moto.db" \
POSTGRES_URL="postgresql://bcnrockers:bcnrockers_password@localhost:5432/bcnrockers_db" \
backend/venv/bin/python backend/migrate_sqlite_to_postgres.py
```

### 3. Verifica los datos migrados

```bash
docker compose exec postgres psql -U bcnrockers -d bcnrockers_db \
  -c "SELECT COUNT(*) FROM users;" \
  -c "SELECT COUNT(*) FROM rutas;" \
  -c "SELECT COUNT(*) FROM rutas_publicadas;"
```

---

## Despliegue en Render

### Base de datos (Render Postgres)

1. En el dashboard de Render, crea un nuevo **PostgreSQL** service
2. Copia la **Internal Database URL** (para usar dentro de Render) o la **External Database URL** (para migrar datos desde local)
3. Guarda la URL — la necesitarás para el backend

### Backend (Render Web Service)

1. Crea un nuevo **Web Service** apuntando al repositorio
2. Configura:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. En **Environment Variables**, enlaza la base Postgres (Render suele crear `DATABASE_URL`) o define manualmente **`POSTGRES_URL`** / **`DATABASE_URL`** con la Internal URL:
   ```
   POSTGRES_URL=<Internal Database URL de Render Postgres>
   SECRET_KEY=<clave-aleatoria-segura>
   DEBUG=False
   ```
   (`DATABASE_URL` con la misma URL que Postgres también es válido.)

### Migrar datos a Render Postgres

Desde tu máquina local, usando la **External Database URL**:

```bash
backend/venv/bin/python backend/migrate_sqlite_to_postgres.py \
  --sqlite "sqlite:///./backend/rutas_moto.db" \
  --postgres "<External Database URL de Render>"
```

---

## Notas importantes

- **El script de migración es idempotente**: si lo ejecutas varias veces, borra y re-inserta los datos. Úsalo solo para la migración inicial.
- **Las secuencias de IDs** se ajustan automáticamente para que los nuevos registros no colisionen con los migrados.
- **`pool_pre_ping=True`** en la configuración del engine verifica la conexión antes de usarla, evitando errores por conexiones caducadas (importante en Render que puede pausar el servicio).
- **`pool_recycle=300`** recicla conexiones cada 5 minutos, evitando timeouts de PostgreSQL.
