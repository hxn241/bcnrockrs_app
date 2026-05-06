import { nombreComunidad, nombreProvincia } from './espanaUbicacion'

/** Códigos ISO 3166-1 alpha-2 usados al publicar / filtrar salidas. */
export const PAIS_SALIDA_OPCIONES = [
  { code: 'ES', label: 'España' },
  { code: 'PT', label: 'Portugal' },
  { code: 'FR', label: 'Francia' },
  { code: 'DE', label: 'Alemania' },
  { code: 'IT', label: 'Italia' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'NL', label: 'Países Bajos' },
  { code: 'BE', label: 'Bélgica' },
  { code: 'AT', label: 'Austria' },
  { code: 'CH', label: 'Suiza' },
]

export function labelPais(code) {
  if (!code) return ''
  const u = String(code).toUpperCase()
  const hit = PAIS_SALIDA_OPCIONES.find((p) => p.code === u)
  return hit ? hit.label : u
}

/** Texto compacto para tarjetas y detalle (España + CCAA + provincia si hay códigos). */
export function formatUbicacionSalida(route) {
  if (!route) return ''
  const parts = []
  const pais = route.ubicacion_pais || 'ES'
  parts.push(labelPais(pais))
  const ccaaCode = route.ubicacion_region
  const provCode = route.ubicacion_ciudad
  if (pais === 'ES') {
    const ccaaNombre = nombreComunidad(ccaaCode)
    const provNombre = nombreProvincia(provCode)
    if (ccaaNombre) parts.push(ccaaNombre)
    else if (ccaaCode) parts.push(ccaaCode)
    if (provNombre) parts.push(provNombre)
    else if (provCode) parts.push(provCode)
  } else {
    if (ccaaCode) parts.push(ccaaCode)
    if (provCode) parts.push(provCode)
  }
  return parts.join(' · ')
}
