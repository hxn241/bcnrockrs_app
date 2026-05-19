import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

let fixed = false

/** Corrige rutas de iconos por defecto en bundlers (Vite). */
export function fixLeafletDefaultIcons() {
  if (fixed) return
  fixed = true
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl,
    iconRetinaUrl,
    shadowUrl
  })
}
