# Datos locales de Valhalla (Docker)

La carpeta **`custom_files`** se monta en el contenedor como `/custom_files`. Ahí la imagen guarda:

- Extractos `.osm.pbf` (opcional si usas `tile_urls` en compose)
- Tiles y configuración generados (`valhalla.json`, etc.)

**No hace falta** commitear nada aquí salvo este README y `.gitkeep`; el contenido generado está en `.gitignore`.

Para una zona distinta, cambia `tile_urls` en `docker-compose.yml` (servicio `valhalla`) y reinicia el contenedor (posible reconstrucción del grafo).

Fuentes de datos OSM por región: [Geofabrik](https://download.geofabrik.de/).
