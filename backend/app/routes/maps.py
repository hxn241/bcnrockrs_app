from __future__ import annotations

import re
import urllib.request
from typing import Optional
import requests
from fastapi import APIRouter, HTTPException
from urllib.parse import unquote, unquote_plus, quote, urlparse, parse_qs

from app.config import settings

router = APIRouter(prefix="/maps", tags=["maps"])

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

        pairs_2m2, pairs_all = parse_dir_data_coordinate_pairs(url)
        segments = enrich_ambiguous_stops(segments, pairs_2m2, pairs_all)
        segments = substitute_trivial_map_path_tokens(segments, pairs_all)
        segments = trim_circular_duplicate_endpoint(segments)
        segments = simplify_segments_for_directions_embed(segments)

        if len(segments) < 2:
            raise HTTPException(
                status_code=400,
                detail="No se pudieron extraer los puntos de la ruta",
            )

        return {"embed_url": _segments_to_embed_url(segments)}

    except HTTPException:
        raise
    except Exception as e:
        _log_debug(f"maps/embed: {type(e).__name__}: {e}")
        if settings.debug:
            import traceback

            traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
