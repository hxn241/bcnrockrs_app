from __future__ import annotations

import json
import re
import urllib.request
from typing import Optional
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from urllib.parse import unquote, unquote_plus, quote, urlparse, parse_qs

from app.auth import get_current_user
from app.config import settings
from app.models import User

router = APIRouter(prefix="/maps", tags=["maps"])

# Búsqueda de lugares (proxy Nominatim — uso moderado; ver políticas OSM).
_NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
_NOMINATIM_UA = (
    "KurveMaster/1.0 (route planner; +https://kurvemaster-app-frontend.vercel.app)"
)

_MAX_SEGMENT_LEN = 512
_SHORT_LINK_TIMEOUT_S = 10
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-ES,es;q=0.9,ca;q=0.8",
}

# Path tokens que Google usa (p. ej. BonÀrea) y la Embed API no geocodifica.
_TRIVIAL_MAP_PATH_TOKENS = frozenset({"bp"})


def _log_debug(msg: str) -> None:
    if getattr(settings, "debug", False):
        print(msg)


def _is_short_maps_link(url: str) -> bool:
    u = (url or "").lower()
    return "maps.app.goo.gl" in u or ("goo.gl" in u and "maps" in u)


def resolve_short_maps_url(url: str) -> str:
    """Una petición HTTP + opcional urllib; sin reintentos en bucle ni sleeps."""
    url = (url or "").strip()
    if not _is_short_maps_link(url):
        return url

    try:
        r = requests.get(
            url,
            allow_redirects=True,
            timeout=_SHORT_LINK_TIMEOUT_S,
            headers=_BROWSER_HEADERS,
        )
        out = unwrap_google_consent_url(r.url)
        if "maps.app.goo.gl" not in out.split("?", 1)[0]:
            return out
    except Exception as e:
        _log_debug(f"maps: resolve corto (requests): {e}")

    try:
        req = urllib.request.Request(url, headers=_BROWSER_HEADERS, method="GET")
        with urllib.request.urlopen(req, timeout=_SHORT_LINK_TIMEOUT_S) as resp:
            return unwrap_google_consent_url(resp.geturl())
    except Exception as e:
        _log_debug(f"maps: resolve corto (urllib): {e}")

    return url


def unwrap_google_consent_url(url: str) -> str:
    if "consent.google.com" not in url:
        return url
    try:
        parsed = urlparse(url)
        cont = parse_qs(parsed.query).get("continue")
        if cont and cont[0]:
            return unquote_plus(cont[0])
    except Exception as e:
        _log_debug(f"maps: consent parse_qs: {e}")
    if "continue=" in url:
        try:
            part = url.split("continue=", 1)[1].split("&gl=", 1)[0]
            return unquote_plus(part)
        except Exception as e:
            _log_debug(f"maps: consent fallback: {e}")
    return url


def _is_latlng(text: str) -> bool:
    text = (text or "").strip()
    parts = text.split(",")
    if len(parts) != 2:
        return False
    try:
        a, b = float(parts[0].strip()), float(parts[1].strip())
    except ValueError:
        return False
    return -90 <= a <= 90 and -180 <= b <= 180


def _parse_latlng_pair(text: str) -> Optional[tuple[float, float]]:
    if not _is_latlng(text):
        return None
    parts = text.strip().split(",")
    return float(parts[0].strip()), float(parts[1].strip())


def _same_route_endpoint(a: str, b: str) -> bool:
    if (a or "").strip().lower() == (b or "").strip().lower():
        return True
    pa = _parse_latlng_pair(a or "")
    pb = _parse_latlng_pair(b or "")
    if pa and pb:
        return abs(pa[0] - pb[0]) < 1e-4 and abs(pa[1] - pb[1]) < 1e-4
    return False


def _is_ambiguous_service_station_label(text: str) -> bool:
    t = (text or "").strip()
    # No usar "," in t: las direcciones completas llevan comas y sí deben enriquecerse.
    if _is_latlng(t):
        return False
    tl = t.lower()
    markers = (
        "estación de servicio",
        "estacio de servei",
        "gasolinera",
        "benzinera",
        "gas station",
        "petrol station",
    )
    return any(m in tl for m in markers) and len(t) < 160


def _data_payload(url: str) -> Optional[str]:
    if "/data=" not in url:
        return None
    try:
        return url.split("/data=", 1)[1].split("?", 1)[0]
    except IndexError:
        return None


def parse_dir_data_coordinate_pairs(url: str) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    """
    Lee el fragmento data=!… una sola vez.
    Devuelve (solo_!2m2!, todos_los_pares_en_orden) para enrich vs sustitución bp/últimos.
    """
    rest = _data_payload(url)
    if not rest:
        return [], []

    pairs_2m2: list[tuple[float, float]] = []
    hits: list[tuple[int, float, float]] = []
    for m in re.finditer(r"!2m2!1d([\d.+-]+)!2d([\d.+-]+)", rest):
        lng, lat = float(m.group(1)), float(m.group(2))
        pairs_2m2.append((lat, lng))
        hits.append((m.start(), lat, lng))
    for m in re.finditer(r"!8m2!3d([\d.+-]+)!4d([\d.+-]+)", rest):
        lat, lng = float(m.group(1)), float(m.group(2))
        hits.append((m.start(), lat, lng))
    hits.sort(key=lambda x: x[0])

    pairs_all: list[tuple[float, float]] = []
    for _, lat, lng in hits:
        if pairs_all:
            olat, olng = pairs_all[-1]
            if abs(olat - lat) < 1e-5 and abs(olng - lng) < 1e-5:
                continue
        pairs_all.append((lat, lng))

    return pairs_2m2, pairs_all


def enrich_ambiguous_stops(
    segments: list[str],
    pairs_2m2: list[tuple[float, float]],
    pairs_all: list[tuple[float, float]],
) -> list[str]:
    pairs = pairs_2m2 if pairs_2m2 else pairs_all
    if not pairs:
        return segments

    named_idx = [i for i, s in enumerate(segments) if not _is_latlng(s)]
    out = list(segments)
    for rank, pos in enumerate(named_idx):
        if rank >= len(pairs):
            break
        if _is_ambiguous_service_station_label(out[pos]):
            lat, lng = pairs[rank]
            out[pos] = f"{lat},{lng}"
    return out


def substitute_trivial_map_path_tokens(
    segments: list[str], pairs_all: list[tuple[float, float]]
) -> list[str]:
    if not pairs_all:
        return segments
    idxs = [i for i, s in enumerate(segments) if s.strip().lower() in _TRIVIAL_MAP_PATH_TOKENS]
    if not idxs:
        return segments

    out = list(segments)
    lat0, lng0 = pairs_all[0]
    if len(idxs) == 1:
        out[idxs[0]] = f"{lat0},{lng0}"
        return out

    lat1, lng1 = pairs_all[-1] if len(pairs_all) > 1 else (lat0, lng0)
    out[idxs[0]] = f"{lat0},{lng0}"
    out[idxs[-1]] = f"{lat1},{lng1}"
    return out


def trim_circular_duplicate_endpoint(segments: list[str]) -> list[str]:
    if len(segments) < 3:
        return segments
    if _same_route_endpoint(segments[0], segments[-1]):
        return segments[:-1]
    return segments


def simplify_segments_for_directions_embed(segments: list[str]) -> list[str]:
    out = list(segments)
    i = 0
    while i < len(out) - 1:
        if len(out) <= 2:
            break
        if _is_ambiguous_service_station_label(out[i]) and _is_latlng(out[i + 1]):
            del out[i]
            continue
        i += 1
    return out


def extract_route_segments(url: str, *, unwrap_consent: bool = True) -> Optional[list[str]]:
    if unwrap_consent:
        url = unwrap_google_consent_url(url)
    if "/maps/dir/" not in url:
        return None

    dir_part = url.split("/maps/dir/", 1)[1]
    if "/@" in dir_part:
        dir_part = dir_part.split("/@", 1)[0]

    segments: list[str] = []
    for seg in dir_part.split("/"):
        decoded = unquote_plus(seg)
        if not decoded.strip() or decoded.startswith("data="):
            continue
        if len(decoded) > _MAX_SEGMENT_LEN:
            _log_debug(f"maps: segmento omitido (>{_MAX_SEGMENT_LEN} chars)")
            continue
        segments.append(decoded.strip())

    return segments if len(segments) >= 2 else None


def extract_location_name(url: str) -> str:
    try:
        if "/place/" in url:
            name = url.split("/place/", 1)[1].split("/")[0].split("@")[0]
            if name:
                decoded = unquote_plus(name).replace("+", " ")
                decoded = re.sub(
                    r"[^\w\s\-,()&áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ]",
                    "",
                    decoded,
                )
                decoded = re.sub(r"\s+", " ", decoded).strip()
                return decoded if decoded else "Ubicación"

        if "/search/" in url:
            name = url.split("/search/", 1)[1].split("/")[0].split("@")[0]
            if name:
                decoded = unquote_plus(name).replace("+", " ")
                decoded = re.sub(
                    r"[^\w\s\-,()&áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ]",
                    "",
                    decoded,
                )
                decoded = re.sub(r"\s+", " ", decoded).strip()
                return decoded if decoded else "Ubicación"

        if "?q=" in url or "&q=" in url:
            try:
                q = unquote_plus(url.split("q=", 1)[1].split("&")[0])
                if q:
                    q = re.sub(
                        r"[^\w\s\-,()&áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ]",
                        "",
                        q,
                    )
                    q = re.sub(r"\s+", " ", q).strip()
                    return q if q else "Ubicación"
            except Exception:
                pass
    except Exception:
        pass
    return "Ubicación"


def _segments_to_embed_url(segments: list[str]) -> str:
    origin = segments[0]
    destination = segments[-1]
    waypoints = segments[1:-1]
    embed_url = (
        "https://www.google.com/maps/embed/v1/directions"
        f"?key={settings.google_maps_api_key}"
        "&mode=driving"
        "&units=metric"
        "&region=es"
        f"&origin={quote(origin)}"
        f"&destination={quote(destination)}"
    )
    if waypoints:
        embed_url += "&waypoints=" + "|".join(quote(wp) for wp in waypoints)
    return embed_url


def build_embed_url_from_dir_maps_url(url: str) -> Optional[str]:
    """
    A partir de una URL ya expandida y sin consent (puede ser /maps/dir/…).
    Devuelve la URL del iframe Embed API o None si no es un recorrido válido.
    """
    try:
        segments = extract_route_segments(url, unwrap_consent=False)
        if not segments or len(segments) < 2:
            return None
        pairs_2m2, pairs_all = parse_dir_data_coordinate_pairs(url)
        segments = enrich_ambiguous_stops(segments, pairs_2m2, pairs_all)
        segments = substitute_trivial_map_path_tokens(segments, pairs_all)
        segments = trim_circular_duplicate_endpoint(segments)
        segments = simplify_segments_for_directions_embed(segments)
        if len(segments) < 2:
            return None
        return _segments_to_embed_url(segments)
    except Exception as e:
        _log_debug(f"maps: build_embed_url_from_dir_maps_url: {e}")
        return None


def compute_route_embed_url(link_ruta: str) -> Optional[str]:
    """
    Desde el enlace guardado en BD (corto o largo): resuelve redirects y genera
    la URL del iframe una sola vez para persistir en servidor.
    """
    url = (link_ruta or "").strip()
    if not url:
        return None
    try:
        url = resolve_short_maps_url(url)
        url = unwrap_google_consent_url(url)
        return build_embed_url_from_dir_maps_url(url)
    except Exception as e:
        _log_debug(f"maps: compute_route_embed_url: {e}")
        return None


class GeocodeItem(BaseModel):
    lat: float
    lng: float
    label: str


@router.get("/geocode", response_model=list[GeocodeItem])
def geocode_place_search(
    q: str,
    limit: int = 8,
    current_user: User = Depends(get_current_user),
):
    """
    Busca lugares vía Nominatim (OpenStreetMap). Sesión requerida para limitar abuso.
    Resultados priorizados en España (countrycodes=es).
    """
    query = (q or "").strip()
    if len(query) < 2:
        raise HTTPException(
            status_code=400,
            detail="Escribe al menos 2 caracteres para buscar.",
        )
    lim = max(1, min(int(limit), 10))

    params = {
        "q": query,
        "format": "json",
        "limit": str(lim),
        "addressdetails": "0",
        "countrycodes": "es",
    }
    headers = {
        "User-Agent": _NOMINATIM_UA,
        "Accept-Language": "es,en;q=0.8",
    }

    try:
        r = requests.get(
            _NOMINATIM_SEARCH,
            params=params,
            headers=headers,
            timeout=14,
        )
        r.raise_for_status()
        rows = r.json()
        if not isinstance(rows, list):
            rows = []
    except requests.RequestException as e:
        _log_debug(f"nominatim search: {e}")
        raise HTTPException(
            status_code=502,
            detail="El servicio de búsqueda no respondió. Prueba otra vez en unos segundos.",
        )

    out: list[GeocodeItem] = []
    for item in rows[:lim]:
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
            label = str(item.get("display_name") or f"{lat:.5f}, {lon:.5f}")
            out.append(GeocodeItem(lat=lat, lng=lon, label=label))
        except (KeyError, TypeError, ValueError):
            continue

    return out


_OSRM_MAX_WAYPOINTS = 25
_OSRM_MAX_RESPONSE_VERTICES = 1600
_OSRM_TIMEOUT_S = 35
_VALHALLA_TIMEOUT_S = 45


def _decode_polyline6(encoded: str) -> list[list[float]]:
    """Decodifica polyline con precisión 6 (Valhalla/Google). Devuelve [[lng, lat], ...]."""
    if not encoded or not isinstance(encoded, str):
        return []
    coordinates: list[list[float]] = []
    index = 0
    lat = 0
    lng = 0
    length = len(encoded)
    while index < length:
        result = 0
        shift = 0
        while True:
            if index >= length:
                return coordinates
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat
        result = 0
        shift = 0
        while True:
            if index >= length:
                return coordinates
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng
        coordinates.append([lng / 1e6, lat / 1e6])
    return coordinates


def _merge_valhalla_leg_shapes(legs: list[dict]) -> list[list[float]]:
    full: list[list[float]] = []
    for leg in legs:
        part = _decode_polyline6(str(leg.get("shape") or ""))
        if not part:
            continue
        if full and part:
            a, b = full[-1], part[0]
            if abs(a[0] - b[0]) < 1e-7 and abs(a[1] - b[1]) < 1e-7:
                part = part[1:]
        full.extend(part)
    return full


def _dedupe_coords_osrm(coords: list[list[float]]) -> list[list[float]]:
    out: list[list[float]] = []
    for lng, lat in coords:
        lng_f, lat_f = float(lng), float(lat)
        if out:
            plng, plat = out[-1]
            if abs(plng - lng_f) < 1e-8 and abs(plat - lat_f) < 1e-8:
                continue
        out.append([lng_f, lat_f])
    return out


def _decimate_line_coords(coords: list[list[float]], max_n: int) -> list[list[float]]:
    if len(coords) <= max_n:
        return coords
    n = len(coords)
    out: list[list[float]] = []
    for i in range(max_n):
        idx = int(round(i * (n - 1) / max(1, max_n - 1)))
        idx = max(0, min(n - 1, idx))
        out.append(coords[idx])
    return out


class OsrmRouteRequest(BaseModel):
    coordinates: list[list[float]]

    @field_validator("coordinates")
    @classmethod
    def validate_coords(cls, v: list) -> list:
        if not v or len(v) < 2:
            raise ValueError("Al menos 2 coordenadas [lng, lat].")
        if len(v) > _OSRM_MAX_WAYPOINTS:
            raise ValueError(f"Como máximo {_OSRM_MAX_WAYPOINTS} puntos de paso.")
        for pair in v:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise ValueError("Cada punto debe ser [lng, lat].")
            lng, lat = float(pair[0]), float(pair[1])
            if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
                raise ValueError("Coordenadas fuera de rango.")
        return v


class OsrmRouteResponse(BaseModel):
    geojson: str
    distance_m: float = 0.0
    duration_s: float = 0.0


class OsrmGuidanceStep(BaseModel):
    distance_m: float = 0.0
    duration_s: float = 0.0
    instruction_en: str = ""
    street_name: str = ""
    location_lng: float
    location_lat: float
    maneuver_type: Optional[str] = None
    maneuver_modifier: Optional[str] = None
    source: Optional[str] = None


class OsrmGuidanceResponse(BaseModel):
    geojson: str
    distance_m: float = 0.0
    duration_s: float = 0.0
    steps: list[OsrmGuidanceStep]
    engine: str = "osrm"


def _parse_osrm_guidance_steps(data: dict) -> list[OsrmGuidanceStep]:
    steps_out: list[OsrmGuidanceStep] = []
    routes = data.get("routes") or []
    if not routes:
        return steps_out
    for leg in routes[0].get("legs") or []:
        for step in leg.get("steps") or []:
            maneuver = step.get("maneuver") or {}
            loc = maneuver.get("location")
            if not isinstance(loc, (list, tuple)) or len(loc) < 2:
                continue
            try:
                lng_f = float(loc[0])
                lat_f = float(loc[1])
            except (TypeError, ValueError):
                continue
            steps_out.append(
                OsrmGuidanceStep(
                    distance_m=float(step.get("distance") or 0.0),
                    duration_s=float(step.get("duration") or 0.0),
                    instruction_en=str(maneuver.get("instruction") or ""),
                    street_name=str(step.get("name") or ""),
                    location_lng=lng_f,
                    location_lat=lat_f,
                    maneuver_type=maneuver.get("type"),
                    maneuver_modifier=maneuver.get("modifier"),
                    source="osrm",
                )
            )
    return steps_out


def _fetch_osrm_guidance_response(coords: list[list[float]]) -> OsrmGuidanceResponse:
    base = settings.osrm_base_url.strip().rstrip("/")
    profile = (settings.osrm_profile or "driving").strip().strip("/") or "driving"
    coord_str = ";".join(f"{c[0]},{c[1]}" for c in coords)
    url = f"{base}/route/v1/{profile}/{coord_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
    }
    headers = {
        "User-Agent": _NOMINATIM_UA,
        "Accept": "application/json",
    }

    try:
        r = requests.get(url, params=params, headers=headers, timeout=_OSRM_TIMEOUT_S)
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        _log_debug(f"osrm guidance request: {e}")
        raise HTTPException(
            status_code=502,
            detail="El servicio OSRM no respondió. Si usas el servidor de demostración, puede estar saturado; prueba más tarde o configura OSRM_BASE_URL.",
        )
    except ValueError as e:
        _log_debug(f"osrm guidance json: {e}")
        raise HTTPException(status_code=502, detail="Respuesta OSRM inválida.")

    if data.get("code") != "Ok":
        msg = data.get("message") or data.get("code") or "No se pudo calcular la ruta."
        raise HTTPException(status_code=400, detail=str(msg))

    routes = data.get("routes") or []
    if not routes:
        raise HTTPException(status_code=400, detail="OSRM no devolvió ninguna ruta.")

    geom = routes[0].get("geometry") or {}
    if geom.get("type") != "LineString":
        raise HTTPException(
            status_code=502,
            detail="Formato de geometría OSRM inesperado.",
        )

    line_coords = geom.get("coordinates") or []
    try:
        parsed = [[float(x), float(y)] for x, y in line_coords]
    except (TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Coordenadas OSRM inválidas.")

    parsed = _decimate_line_coords(parsed, _OSRM_MAX_RESPONSE_VERTICES)
    canonical = {"type": "LineString", "coordinates": parsed}
    geojson_str = json.dumps(canonical, separators=(",", ":"))

    distance_m = float(routes[0].get("distance") or 0.0)
    duration_s = float(routes[0].get("duration") or 0.0)
    steps = _parse_osrm_guidance_steps(data)

    return OsrmGuidanceResponse(
        geojson=geojson_str,
        distance_m=distance_m,
        duration_s=duration_s,
        steps=steps,
        engine="osrm",
    )


def _parse_valhalla_trip_to_response(trip: dict) -> OsrmGuidanceResponse:
    legs = trip.get("legs") or []
    if not legs:
        raise HTTPException(status_code=502, detail="Valhalla no devolvió tramos de ruta.")

    full_line = _merge_valhalla_leg_shapes(legs)
    if len(full_line) < 2:
        raise HTTPException(status_code=502, detail="Geometría Valhalla vacía.")

    summary = trip.get("summary") or {}
    units_raw = str(trip.get("units") or "kilometers").lower()
    use_miles = units_raw.startswith("mi")

    length_raw = float(summary.get("length") or 0.0)
    distance_m = length_raw * 1609.344 if use_miles else length_raw * 1000.0
    duration_s = float(summary.get("time") or 0.0)

    steps_out: list[OsrmGuidanceStep] = []
    for leg in legs:
        decoded = _decode_polyline6(str(leg.get("shape") or ""))
        if not decoded:
            continue
        for m in leg.get("maneuvers") or []:
            bi = int(m.get("begin_shape_index", 0))
            if bi < 0 or bi >= len(decoded):
                continue
            lng_f, lat_f = float(decoded[bi][0]), float(decoded[bi][1])
            seg_len = float(m.get("length") or 0.0)
            seg_m = seg_len * 1609.344 if use_miles else seg_len * 1000.0
            streets = m.get("street_names") or []
            street_name = str(streets[0]) if streets else ""
            mt = m.get("type")
            steps_out.append(
                OsrmGuidanceStep(
                    distance_m=seg_m,
                    duration_s=float(m.get("time") or 0.0),
                    instruction_en=str(m.get("instruction") or ""),
                    street_name=street_name,
                    location_lng=lng_f,
                    location_lat=lat_f,
                    maneuver_type=str(mt) if mt is not None else None,
                    maneuver_modifier=None,
                    source="valhalla",
                )
            )

    parsed = _decimate_line_coords(full_line, _OSRM_MAX_RESPONSE_VERTICES)
    geojson_str = json.dumps(
        {"type": "LineString", "coordinates": parsed},
        separators=(",", ":"),
    )

    return OsrmGuidanceResponse(
        geojson=geojson_str,
        distance_m=distance_m,
        duration_s=duration_s,
        steps=steps_out,
        engine="valhalla",
    )


def _call_valhalla_guidance_once(coords: list[list[float]], costing: str) -> OsrmGuidanceResponse:
    base = settings.valhalla_base_url.strip().rstrip("/")
    url = f"{base}/route"
    lang = (settings.valhalla_guidance_language or "es-ES").strip()
    body: dict = {
        "locations": [{"lon": float(c[0]), "lat": float(c[1])} for c in coords],
        "costing": costing.strip().lower(),
        "units": "kilometers",
        "language": lang,
        "directions_options": {"units": "kilometers", "language": lang},
    }
    headers = {
        "User-Agent": _NOMINATIM_UA,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        r = requests.post(url, json=body, headers=headers, timeout=_VALHALLA_TIMEOUT_S)
    except requests.RequestException as e:
        _log_debug(f"valhalla request: {e}")
        raise HTTPException(
            status_code=502,
            detail="El servicio Valhalla no respondió. Comprueba VALHALLA_BASE_URL y la red.",
        )

    try:
        data = r.json()
    except ValueError as e:
        _log_debug(f"valhalla json: {e}")
        raise HTTPException(status_code=502, detail="Respuesta Valhalla inválida.")

    if r.status_code >= 400:
        msg = (
            data.get("error")
            or data.get("status_message")
            or data.get("detail")
            or (r.text[:400] if r.text else "")
        )
        detail = str(msg) if msg else f"Valhalla HTTP {r.status_code}"
        raise HTTPException(
            status_code=502 if r.status_code >= 500 else 400,
            detail=detail,
        )

    trip = data.get("trip")
    if not isinstance(trip, dict):
        raise HTTPException(status_code=502, detail="Respuesta Valhalla sin campo trip.")

    status = trip.get("status")
    if status is not None and status != 0:
        raise HTTPException(
            status_code=400,
            detail=str(trip.get("status_message") or "Valhalla no calculó la ruta."),
        )

    return _parse_valhalla_trip_to_response(trip)


def _fetch_valhalla_guidance_response(coords: list[list[float]]) -> OsrmGuidanceResponse:
    costing_primary = (settings.valhalla_costing or "motorcycle").strip().lower()
    try_first = [costing_primary]
    if costing_primary != "auto":
        try_first.append("auto")

    last_exc: Optional[HTTPException] = None
    for costing in try_first:
        try:
            return _call_valhalla_guidance_once(coords, costing)
        except HTTPException as e:
            last_exc = e
            if e.status_code == 400 and costing != try_first[-1]:
                _log_debug(f"valhalla costing '{costing}' falló: {e.detail}; probando auto.")
                continue
            raise
    if last_exc:
        raise last_exc
    raise HTTPException(status_code=502, detail="Valhalla no disponible.")


@router.post("/route-osrm", response_model=OsrmRouteResponse)
def route_osrm_drive(
    body: OsrmRouteRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Calcula una ruta por carretera entre varios waypoints usando OSRM (perfil por defecto: driving).
    Requiere sesión. Configura OSRM_BASE_URL para tu instancia en producción.
    """
    coords = _dedupe_coords_osrm(body.coordinates)
    if len(coords) < 2:
        raise HTTPException(
            status_code=400,
            detail="Tras quitar puntos duplicados quedan menos de 2 coordenadas.",
        )

    base = settings.osrm_base_url.strip().rstrip("/")
    profile = (settings.osrm_profile or "driving").strip().strip("/") or "driving"
    coord_str = ";".join(f"{c[0]},{c[1]}" for c in coords)
    url = f"{base}/route/v1/{profile}/{coord_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }
    headers = {
        "User-Agent": _NOMINATIM_UA,
        "Accept": "application/json",
    }

    try:
        r = requests.get(url, params=params, headers=headers, timeout=_OSRM_TIMEOUT_S)
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        _log_debug(f"osrm request: {e}")
        raise HTTPException(
            status_code=502,
            detail="El servicio OSRM no respondió. Si usas el servidor de demostración, puede estar saturado; prueba más tarde o configura OSRM_BASE_URL.",
        )
    except ValueError as e:
        _log_debug(f"osrm json: {e}")
        raise HTTPException(status_code=502, detail="Respuesta OSRM inválida.")

    if data.get("code") != "Ok":
        msg = data.get("message") or data.get("code") or "No se pudo calcular la ruta."
        raise HTTPException(status_code=400, detail=str(msg))

    routes = data.get("routes") or []
    if not routes:
        raise HTTPException(status_code=400, detail="OSRM no devolvió ninguna ruta.")

    geom = routes[0].get("geometry") or {}
    if geom.get("type") != "LineString":
        raise HTTPException(
            status_code=502,
            detail="Formato de geometría OSRM inesperado.",
        )

    line_coords = geom.get("coordinates") or []
    try:
        parsed = [[float(x), float(y)] for x, y in line_coords]
    except (TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Coordenadas OSRM inválidas.")

    parsed = _decimate_line_coords(parsed, _OSRM_MAX_RESPONSE_VERTICES)
    canonical = {"type": "LineString", "coordinates": parsed}
    geojson_str = json.dumps(canonical, separators=(",", ":"))

    distance_m = float(routes[0].get("distance") or 0.0)
    duration_s = float(routes[0].get("duration") or 0.0)

    return OsrmRouteResponse(
        geojson=geojson_str,
        distance_m=distance_m,
        duration_s=duration_s,
    )


@router.post("/route-osrm-guidance", response_model=OsrmGuidanceResponse)
def route_osrm_guidance(
    body: OsrmRouteRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Igual que /route-osrm pero pidiendo pasos a OSRM para navegación guiada (maniobra a maniobra).
    """
    coords = _dedupe_coords_osrm(body.coordinates)
    if len(coords) < 2:
        raise HTTPException(
            status_code=400,
            detail="Tras quitar puntos duplicados quedan menos de 2 coordenadas.",
        )
    return _fetch_osrm_guidance_response(coords)


@router.post("/route-guidance", response_model=OsrmGuidanceResponse)
def route_guidance(
    body: OsrmRouteRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Navegación: Valhalla si VALHALLA_BASE_URL está definido (motor por defecto motorcycle → auto si falla);
    si Valhalla falla, se usa OSRM como respaldo.
    """
    coords = _dedupe_coords_osrm(body.coordinates)
    if len(coords) < 2:
        raise HTTPException(
            status_code=400,
            detail="Tras quitar puntos duplicados quedan menos de 2 coordenadas.",
        )
    if settings.valhalla_base_url.strip():
        try:
            return _fetch_valhalla_guidance_response(coords)
        except HTTPException as e:
            _log_debug(f"route-guidance: Valhalla falló ({e.status_code}): {e.detail}; usando OSRM.")
        except Exception as e:
            _log_debug(f"route-guidance: Valhalla error inesperado: {e}; usando OSRM.")
        return _fetch_osrm_guidance_response(coords)
    return _fetch_osrm_guidance_response(coords)


@router.get("/name/{url:path}")
def get_location_name(url: str):
    try:
        url = unquote(url).strip()
        url = resolve_short_maps_url(url)
        url = unwrap_google_consent_url(url)
        return {"name": extract_location_name(url)}
    except Exception as e:
        _log_debug(f"maps/name: {e}")
        return {"name": "Ubicación"}


@router.get("/embed/{url:path}")
def get_map_embed(url: str):
    try:
        url = unquote(url).strip()
        url = resolve_short_maps_url(url)
        url = unwrap_google_consent_url(url)

        segments = extract_route_segments(url, unwrap_consent=False)
        if not segments or len(segments) < 2:
            if _is_short_maps_link(url):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "El servidor no pudo expandir el enlace corto de Google Maps (maps.app.goo.gl). "
                        "Comprueba la red del backend o usa la URL larga de «Indicaciones»."
                    ),
                )
            if "/maps/dir/" not in url:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Este enlace no es una ruta paso a paso (/maps/dir/…). "
                        "En Maps: Compartir → copiar enlace de la ruta."
                    ),
                )
            raise HTTPException(
                status_code=400,
                detail="No se pudieron extraer los puntos de la ruta",
            )

        embed = build_embed_url_from_dir_maps_url(url)
        if not embed:
            raise HTTPException(
                status_code=400,
                detail="No se pudieron extraer los puntos de la ruta",
            )

        return {"embed_url": embed}

    except HTTPException:
        raise
    except Exception as e:
        _log_debug(f"maps/embed: {type(e).__name__}: {e}")
        if settings.debug:
            import traceback

            traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
