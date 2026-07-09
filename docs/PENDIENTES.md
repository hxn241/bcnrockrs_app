# Pendientes — BCN Rockers

Lista de mejoras identificadas en la revisión del proyecto, para tener en cuenta
más adelante. La app funciona en local con Docker; nada de esto bloquea el uso diario.

> **Contexto:** de momento la app se usa **solo en local** (Docker). Los puntos
> marcados como _"solo producción"_ únicamente aplican si algún día se despliega
> en internet (Render + Vercel).

---

## Ya hecho (referencia)

- ✅ Fix del `frontend/Dockerfile` (rutas `COPY` para el contexto `./frontend`).
- ✅ El administrador de la app puede eliminar cualquier grupo (backend + UI).
- ✅ Rechazar el arranque en `APP_ENV=prod` si `SECRET_KEY` es un placeholder del repo.
- ✅ Migrado el evento de arranque deprecado (`on_event`) al patrón `lifespan`.
- ✅ Eliminada la dependencia `PyJWT` no usada.

---

## Pendiente

### 1. Borrado de usuarios con integridad
- **Qué falta:** no hay endpoint para borrar usuarios, ni cascadas a nivel de BD.
  Las claves foráneas existen, pero el borrado se hace a mano en el código.
- **Riesgo:** borrar un usuario que tenga rutas, grupos o asistencias dejaría
  filas huérfanas o fallaría. (El borrado de `tutu` funcionó solo porque no tenía datos.)
- **Cómo:** definir `ON DELETE` en las FKs (o borrado lógico) y añadir un endpoint
  de admin para gestionar usuarios.
- **Archivos:** `backend/app/models/models.py`, `backend/app/routes/auth.py`.
- **Relevante si:** se quiere gestionar usuarios desde el panel de admin.

### 2. Migraciones de esquema con Alembic
- **Qué falta:** `init_db()` usa `create_all`, que crea tablas nuevas pero **no
  altera** columnas de tablas que ya existen.
- **Riesgo:** al cambiar un modelo en una BD con datos, esos datos no se migran.
- **Cómo:** configurar Alembic (el propio código ya lo recomienda en un comentario).
- **Archivos:** `backend/app/database.py`.

### 3. Tests
- **Qué falta:** el proyecto no tiene ningún test.
- **Prioridad:** sobre todo la lógica de **permisos** (organizador, creador de grupo,
  admin), que es fácil de romper sin darse cuenta.
- **Cómo:** `pytest` + `TestClient` de FastAPI.

### 4. Base de datos SQLite dentro del repositorio
- **Qué falta:** `backend/rutas_moto.db` está commiteada (con una excepción explícita
  en `.gitignore`) e incluye **hashes de contraseñas** de usuarios reales.
- **Riesgo:** fuga de datos si el repositorio es público o se comparte.
- **Cómo:** sacarla del control de versiones (`git rm --cached`) y quitar la excepción
  del `.gitignore`. Nota: ya está en el historial de git; para borrarla del todo habría
  que reescribir el historial. La app usa **PostgreSQL** ahora; esa SQLite es legado.

---

## Solo producción (descartado mientras sea local)

Aplican únicamente si en el futuro se despliega en Render + Vercel:

- **Dominios placeholder:** sustituir `https://tu-app.vercel.app`
  (`backend/app/config.py`) y `https://tu-backend.onrender.com`
  (`frontend/src/utils/apiBaseUrl.js`) por los dominios reales, o dejarlo todo en
  variables de entorno (`CORS_ORIGINS`, `VITE_API_URL`).
- **CORS abierto en producción:** el regex de `main.py` permite cualquier IP de LAN
  y el túnel dynv6 con credenciales, en todos los entornos. En prod debería
  desactivarse y dejar solo la lista blanca explícita.
- **`package-lock.json` ignorado:** está en `.gitignore`, lo que hace los builds de
  Vercel/Docker no reproducibles. Convendría trackear el lockfile del frontend.

---

## Menores

- **`ubicacion_pais`** es `String(2)` con códigos, pero región/ciudad de la salida son
  texto libre, mientras que la plantilla usa códigos INE: dos criterios de zona mezclados.
- **Token JWT en `localStorage`** (frontend): accesible a scripts (riesgo XSS). Es lo
  habitual en SPAs, pero conviene saberlo.
- **Sin refresco de sesión:** al caducar el token (8 h) el usuario recibe 401 sin un
  cierre de sesión limpio.

---

## Configuración pendiente (no es código)

- **Acceso desde el iPhone con un atajo:** usar la app *Atajos* de iOS con la acción
  "Ejecutar script por SSH" para levantar/parar la app en el PC de forma remota.
  - El servidor SSH del PC **ya está activo** (puerto 22, todas las interfaces).
  - Arrancar: `cd /home/hexen/bcnrockersapp && docker compose up -d`
  - Parar: `cd /home/hexen/bcnrockersapp && docker compose down` (conserva la BD;
    usar `down -v` **borraría** los datos).
  - Acceso: misma WiFi → `192.168.1.40`; fuera de casa → conectar WireGuard primero.
  - Pendiente de verificar: que el firewall (ufw) no bloquee el puerto 22.
