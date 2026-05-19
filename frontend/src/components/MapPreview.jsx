import GoogleMapEmbed from './GoogleMapEmbed'
import OsmRouteMap from './OsmRouteMap'
import '../styles/GoogleMapEmbed.css'

export default function MapPreview({
  url,
  embedUrl,
  title,
  mapSource = 'google',
  recorridoGeojson
}) {
  const srcNorm = String(mapSource || 'google').trim().toLowerCase()
  const isOsm = srcNorm === 'osm'
  const geo =
    typeof recorridoGeojson === 'string' ? recorridoGeojson.trim() : ''

  if (isOsm && geo) {
    return (
      <div className="google-map-embed">
        <h4>{title}</h4>
        <div className="map-container map-container-osm">
          <OsmRouteMap lineGeoJson={geo} editable={false} height={300} />
        </div>
      </div>
    )
  }

  if (isOsm && !geo) {
    return (
      <div className="google-map-embed">
        <h4>{title}</h4>
        <div className="map-container">
          <p className="map-error map-error--full">
            Esta plantilla está marcada como mapa abierto pero no tiene geometría del recorrido guardada.
          </p>
        </div>
      </div>
    )
  }

  return <GoogleMapEmbed url={url} embedUrl={embedUrl} title={title} />
}
