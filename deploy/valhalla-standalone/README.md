# Valhalla independiente (producción)

Sirve para tener una URL pública **`https://…`** que el backend de KurveMaster (p. ej. en **Render**) llamará como:

`POST {VALHALLA_BASE_URL}/route`

## Requisitos

- Un VPS o máquina con **Docker** y espacio en disco (extractos OSM + tiles).
- **RAM**: construir Cataluña puede pedir **varios GB**; si falla por memoria, usa un extracto más pequeño (p. ej. Andorra) solo para pruebas.
- En **Render**, variable **`VALHALLA_BASE_URL`** = tu URL **HTTPS** **sin** barra final, p. ej. `https://valhalla.tudominio.com`.

## Arranque rápido (HTTP directo al puerto 8002)

En el servidor:

```bash
cd deploy/valhalla-standalone
docker compose up -d
```

Espera a que termine la construcción del grafo (ver `docker compose logs -f valhalla`). Prueba:

```bash
curl -sS -X POST http://127.0.0.1:8002/route \
  -H 'Content-Type: application/json' \
  -d '{"locations":[{"lat":41.387,"lon":2.168},{"lat":41.403,"lon":2.174}],"costing":"auto","units":"kilometers"}' | head -c 400
```

Si ves JSON con `"trip"`, el servicio responde.

## HTTPS (recomendado para Render)

Render puede llamar por HTTP a URLs públicas, pero es mejor exponer **HTTPS** con dominio propio:

1. Apunta un **DNS A/AAAA** al VPS.
2. Copia `Caddyfile.example` → `Caddyfile` y pon tu dominio.
3. Deja Valhalla solo en `127.0.0.1:8002` (cierra el puerto al mundo en el firewall; solo Caddy escucha 443).
4. Instala [Caddy](https://caddyserver.com/) en el host o usa otro proxy (nginx, Traefik) con certificado Let’s Encrypt.

En Render:

```env
VALHALLA_BASE_URL=https://valhalla.tudominio.com
VALHALLA_COSTING=motorcycle
VALHALLA_GUIDANCE_LANGUAGE=es-ES
```

## Cambiar zona OSM

Edita `tile_urls` en `docker-compose.yml`, borra el contenido generado en `custom_files` (salvo que sepas usar `force_rebuild` de la imagen) y vuelve a levantar el servicio. Documentación de la imagen: [docker-valhalla](https://github.com/nilsnolde/docker-valhalla).

## Seguridad

No es obligatorio, pero conviene **restringir** quién puede hacer `POST /route` (firewall por IP del egress de Render, o Basic Auth delante del proxy). Si lo dejas abierto, cualquiera podría usar tu CPU para rutas.
