# Valhalla en KurveMaster

La navegación usa **`POST /maps/route-guidance`**. Si el backend tiene **`VALHALLA_BASE_URL`** definida, intenta **Valhalla** primero; si falla o está vacía, usa **OSRM**.

## 1. Variables del backend (`backend/.env` o entorno del proceso)

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `VALHALLA_BASE_URL` | Sí, para usar Valhalla | URL base **sin barra final**. El código llama a `{VALHALLA_BASE_URL}/route`. Ej.: `http://localhost:8003` (Valhalla en el host) o `http://valhalla:8002` (Valhalla en la misma red Docker). |
| `VALHALLA_COSTING` | No | Por defecto `motorcycle`. Si Valhalla rechaza el costing, el backend reintenta con `auto`. |
| `VALHALLA_GUIDANCE_LANGUAGE` | No | Por defecto `es-ES` (instrucciones de maniobra). |

Tras cambiar variables, **reinicia el backend**.

Comprueba en la app (pantalla de navegación) que en el panel de indicaciones aparece **`Valhalla`** junto a la distancia/ETA. Si ves **`OSRM`**, Valhalla no se está usando o ha fallado y se aplicó el fallback.

## 2. Opción rápida: Docker Compose (perfil `valhalla`)

Desde la raíz del repo:

```bash
# 1) Asegúrate de tener un .env en la raíz (gitignored) con:
#    VALHALLA_BASE_URL=http://valhalla:8002
#    (Ver ejemplo abajo.)

# 2) Levanta Postgres + backend + frontend + Valhalla
docker compose --profile valhalla up --build
```

- El servicio **Valhalla** escucha en el host en el puerto **`8003`** (`localhost:8003`).
- La **primera vez** descarga un extracto OSM pequeño y **construye el grafo** (puede tardar varios minutos y usar CPU/RAM). Luego arranca el API en el puerto interno `8002`.
- Los datos generados quedan en `docker/valhalla/custom_files/` (ignorados por git salvo `.gitkeep`).

### Cambiar la zona (p. ej. Cataluña)

Edita `docker-compose.yml`, servicio `valhalla`, variable `tile_urls`. Ejemplo para Cataluña:

```yaml
- tile_urls=https://download.geofabrik.de/europe/spain/cataluna-latest.osm.pbf
```

Luego borra o renombra `docker/valhalla/custom_files` **solo si quieres forzar reconstrucción** (o usa las variables del contenedor `force_rebuild` según la [documentación de la imagen](https://github.com/nilsnolde/docker-valhalla)).

### Backend fuera de Docker, Valhalla en Docker

En `backend/.env`:

```env
VALHALLA_BASE_URL=http://127.0.0.1:8003
```

## 3. Ejemplo `.env` en la raíz (para Compose)

Crea un fichero `.env` junto a `docker-compose.yml`:

```env
VALHALLA_BASE_URL=http://valhalla:8002
VALHALLA_COSTING=motorcycle
VALHALLA_GUIDANCE_LANGUAGE=es-ES
```

Sin `VALHALLA_BASE_URL` (o vacío), el backend **no** llamará a Valhalla.

## 4. Producción (Vercel + Render u otro API)

La navegación en la app llama a **`POST /maps/route-guidance`** en **tu backend** (no llama a Valhalla desde el navegador). Por tanto:

1. **Frontend (Vercel)** — Variable **`VITE_API_URL`** = URL HTTPS del backend (**sin** `/` final). Tras cambiarla, haz **nuevo deploy** (Vite la incrusta en build).
2. **Backend (Render, etc.)** — Debe poder hacer peticiones **salientes** a `{VALHALLA_BASE_URL}/route`. Conviene que **`VALHALLA_BASE_URL` sea `https://…`** con dominio y certificado válidos.

### 4.1 Checklist: que la ruta se vea y «funcione» la navegación

| Requisito | Por qué |
|-----------|---------|
| La salida tiene **mapa abierto (OSM)** y **recorrido guardado** | En código: `map_source === 'osm'` y `recorrido_geojson`. Si la plantilla es solo enlace Google, verás *«Esta salida no tiene recorrido en mapa abierto»* y no hay modo navegación útil. |
| Crear/editar la ruta en la app con el **editor OSM** (catálogo) | Así se guarda el GeoJSON en base de datos. |
| Usuario **logueado** | `/maps/route-guidance` exige JWT (igual que el resto de maps protegidos). |
| **`VALHALLA_BASE_URL`** en el backend en producción | Sin eso (o vacío), solo se usa **OSRM** en ese endpoint. |
| Valhalla con **tiles que cubran la zona** de la ruta | Si el extracto OSM es solo Andorra y la ruta está en Barcelona, Valhalla puede fallar; el backend hará **fallback a OSRM** si está configurado. |

En la pantalla de navegación, si todo va bien con Valhalla, el panel muestra la etiqueta **Valhalla**. Si ves **OSRM**, o no hay Valhalla configurado o ha fallado y se usó el respaldo.

### 4.2 Variables en Render (backend)

Añade (o edita) en el panel de variables de entorno del **Web Service**:

```env
VALHALLA_BASE_URL=https://tu-valhalla-publico.example.com
VALHALLA_COSTING=motorcycle
VALHALLA_GUIDANCE_LANGUAGE=es-ES
```

Opcional pero **muy recomendable** en producción (fallback si Valhalla falla o está saturado):

```env
OSRM_BASE_URL=https://router.project-osrm.org
```

(o tu propia instancia OSRM; el servidor demo puede ir lento).

Sin barra final en las URLs base. Tras guardar, **vuelve a desplegar** el servicio.

### 4.3 Dónde hospedar Valhalla

**Render** no encaja bien para *generar* tiles Valhalla en el mismo dyno (proceso largo, disco). Lo habitual es:

- **VPS** (Hetzner, OVH, Oracle Free Tier, etc.) con Docker.
- En este repo hay un ejemplo mínimo: **[deploy/valhalla-standalone/README.md](../deploy/valhalla-standalone/README.md)** (`docker-compose.yml` con extracto **Cataluña** por defecto + ejemplo **Caddy** para HTTPS).

Flujo típico:

1. Subes `deploy/valhalla-standalone` al servidor (o clonas el repo).
2. `docker compose up -d` y esperas a que termine la construcción.
3. Pones **HTTPS** delante (Caddy, nginx, Cloudflare Tunnel, etc.).
4. Copias la URL en **`VALHALLA_BASE_URL`** en Render.

### 4.4 Probar el backend sin la app

Con un token JWT válido (logueo en `/docs` → **Authorize**):

- **`POST /maps/route-guidance`** con cuerpo `{"coordinates": [[2.17, 41.39], [2.18, 41.40]]}` (lng, lat).

Si devuelve `502` hacia Valhalla, revisa logs del backend en Render y que el VPS permita tráfico desde internet (o desde las IPs de egress de Render si restringes firewall).

### 4.5 Más documentación

- Despliegue general frontend/backend: [DEPLOY.md](DEPLOY.md).
- Variables OSRM/Valhalla en tabla: mismo fichero, § 4 resumen.
