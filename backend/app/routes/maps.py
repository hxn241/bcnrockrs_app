from fastapi import APIRouter, HTTPException
import re
import requests
from urllib.parse import unquote, unquote_plus, quote
from app.config import settings

router = APIRouter(prefix="/maps", tags=["maps"])


def extract_route_segments(url: str):
    """Extrae los segmentos de ruta de una URL de Google Maps"""

    # Si viene del consent de Google, extraer la URL real
    if 'consent.google.com' in url and 'continue=' in url:
        try:
            continue_part = url.split('continue=')[1].split('&gl=')[0]
            url = unquote_plus(continue_part)
            print(f"DEBUG: URL extraída: {url[:200]}")
        except Exception as e:
            print(f"DEBUG: Error extrayendo continue=: {e}")
            return None

    if '/maps/dir/' not in url:
        return None

    # Extraer solo la parte del path (antes del /@ y antes de /data=)
    dir_part = url.split('/maps/dir/')[1]

    # Cortar en /@ si existe
    if '/@' in dir_part:
        dir_part = dir_part.split('/@')[0]

    # Dividir en segmentos
    raw_segments = dir_part.split('/')

    # Limpiar: filtrar segmentos válidos (no data=, no muy largos)
    segments = []
    for seg in raw_segments:
        decoded = unquote_plus(seg)
        # Saltar segmentos que son parámetros de Google o están vacíos
        if not decoded.strip():
            continue
        if decoded.startswith('data='):
            continue
        if len(decoded) > 150:
            continue
        segments.append(decoded.strip())

    print(f"DEBUG: Segments limpios: {segments}")
    return segments if len(segments) >= 2 else None


def extract_location_name(url: str) -> str:
    """Extrae el nombre del lugar de una URL de Google Maps"""
    import re
    try:
        # Patrón 1: /place/NombreDeLugar/...
        if '/place/' in url:
            name = url.split('/place/')[1].split('/')[0].split('@')[0]
            if name:
                decoded = unquote_plus(name).replace('+', ' ')
                # Limpiar caracteres inválidos y espacios
                decoded = re.sub(r'[^\w\s\-,()&áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ]', '', decoded)
                decoded = re.sub(r'\s+', ' ', decoded).strip()
                return decoded if decoded else "Ubicación"

        # Patrón 2: /search/NombreDeLugar/...
        if '/search/' in url:
            name = url.split('/search/')[1].split('/')[0].split('@')[0]
            if name:
                decoded = unquote_plus(name).replace('+', ' ')
                decoded = re.sub(r'[^\w\s\-,()&áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ]', '', decoded)
                decoded = re.sub(r'\s+', ' ', decoded).strip()
                return decoded if decoded else "Ubicación"

        # Patrón 3: parámetro q=
        if '?q=' in url or '&q=' in url:
            try:
                q = unquote_plus(url.split('q=')[1].split('&')[0])
                if q:
                    q = re.sub(r'[^\w\s\-,()&áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ]', '', q)
                    q = re.sub(r'\s+', ' ', q).strip()
                    return q if q else "Ubicación"
            except:
                pass
    except:
        pass

    return "Ubicación"


@router.get("/name/{url:path}")
def get_location_name(url: str):
    """Extrae el nombre de una ubicación de Google Maps"""
    try:
        url = unquote(url)
        print(f"DEBUG: Extrayendo nombre de: {url[:100]}")

        # Resolver URL corta
        if 'maps.app.goo.gl' in url:
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                response = requests.get(url, allow_redirects=True, timeout=5, headers=headers)
                url = response.url
                print(f"DEBUG: URL resuelta para nombre")
            except Exception as e:
                print(f"Error resolviendo URL: {e}")

        # Extraer URL real del consent de Google
        if 'consent.google.com' in url and 'continue=' in url:
            try:
                continue_part = url.split('continue=')[1].split('&gl=')[0]
                url = unquote_plus(continue_part)
            except:
                pass

        name = extract_location_name(url)
        print(f"DEBUG: Nombre extraído: {name}")
        return {"name": name}

    except Exception as e:
        print(f"Error: {e}")
        return {"name": "Ubicación"}


@router.get("/embed/{url:path}")
def get_map_embed(url: str):
    """
    Usa Google Maps Embed API para mostrar rutas
    """
    try:
        url = unquote(url)
        print(f"DEBUG: URL recibida: {url[:100]}")

        # Resolver URL corta
        if 'maps.app.goo.gl' in url:
            print("DEBUG: Resolviendo URL corta...")
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                response = requests.get(url, allow_redirects=True, timeout=5, headers=headers)
                url = response.url
                print(f"DEBUG: URL resuelta: {url[:150]}")
            except Exception as e:
                print(f"DEBUG: Error al resolver URL: {str(e)}")
                pass

        segments = extract_route_segments(url)
        print(f"DEBUG: Segments: {segments}")

        if not segments or len(segments) < 2:
            raise HTTPException(status_code=400, detail="No se pudieron extraer los puntos de la ruta")

        origin = segments[0]
        destination = segments[-1]
        waypoints = segments[1:-1]

        print(f"DEBUG: Origen: {origin}")
        print(f"DEBUG: Destino: {destination}")
        print(f"DEBUG: Waypoints: {waypoints}")

        embed_url = (
            f"https://www.google.com/maps/embed/v1/directions"
            f"?key={settings.google_maps_api_key}"
            f"&origin={quote(origin)}"
            f"&destination={quote(destination)}"
        )

        if waypoints:
            waypoints_str = "|".join([quote(wp) for wp in waypoints])
            embed_url += f"&waypoints={waypoints_str}"

        print(f"DEBUG: Embed URL generada: {embed_url[:200]}")
        return {"embed_url": embed_url}

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
