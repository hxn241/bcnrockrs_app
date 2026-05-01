/**
 * Catálogo España: comunidades autónomas (código corto) y provincias (código INE 2 dígitos).
 * `ubicacion_region` en API = código CCAA; `ubicacion_ciudad` = código provincia ("01"…"52").
 */

export const COMUNIDADES_AUTONOMAS = [
  { code: 'AN', name: 'Andalucía' },
  { code: 'AR', name: 'Aragón' },
  { code: 'AS', name: 'Principado de Asturias' },
  { code: 'IB', name: 'Illes Balears' },
  { code: 'CN', name: 'Canarias' },
  { code: 'CB', name: 'Cantabria' },
  { code: 'CL', name: 'Castilla y León' },
  { code: 'CM', name: 'Castilla-La Mancha' },
  { code: 'CT', name: 'Cataluña' },
  { code: 'VC', name: 'Comunitat Valenciana' },
  { code: 'EX', name: 'Extremadura' },
  { code: 'GA', name: 'Galicia' },
  { code: 'MD', name: 'Comunidad de Madrid' },
  { code: 'MC', name: 'Región de Murcia' },
  { code: 'NC', name: 'Comunidad Foral de Navarra' },
  { code: 'PV', name: 'País Vasco' },
  { code: 'RI', name: 'La Rioja' },
  { code: 'CE', name: 'Ceuta' },
  { code: 'ML', name: 'Melilla' }
].sort((a, b) => a.name.localeCompare(b.name, 'es'))

/** Provincias INE (código 01–52) y CCAA de referencia. */
export const PROVINCIAS_ES = [
  { code: '01', name: 'Álava / Araba', ccaa: 'PV' },
  { code: '02', name: 'Albacete', ccaa: 'CM' },
  { code: '03', name: 'Alicante / Alacant', ccaa: 'VC' },
  { code: '04', name: 'Almería', ccaa: 'AN' },
  { code: '05', name: 'Ávila', ccaa: 'CL' },
  { code: '06', name: 'Badajoz', ccaa: 'EX' },
  { code: '07', name: 'Illes Balears', ccaa: 'IB' },
  { code: '08', name: 'Barcelona', ccaa: 'CT' },
  { code: '09', name: 'Burgos', ccaa: 'CL' },
  { code: '10', name: 'Cáceres', ccaa: 'EX' },
  { code: '11', name: 'Cádiz', ccaa: 'AN' },
  { code: '12', name: 'Castellón / Castelló', ccaa: 'VC' },
  { code: '13', name: 'Ciudad Real', ccaa: 'CM' },
  { code: '14', name: 'Córdoba', ccaa: 'AN' },
  { code: '15', name: 'A Coruña', ccaa: 'GA' },
  { code: '16', name: 'Cuenca', ccaa: 'CM' },
  { code: '17', name: 'Girona', ccaa: 'CT' },
  { code: '18', name: 'Granada', ccaa: 'AN' },
  { code: '19', name: 'Guadalajara', ccaa: 'CM' },
  { code: '20', name: 'Gipuzkoa', ccaa: 'PV' },
  { code: '21', name: 'Huelva', ccaa: 'AN' },
  { code: '22', name: 'Huesca', ccaa: 'AR' },
  { code: '23', name: 'Jaén', ccaa: 'AN' },
  { code: '24', name: 'León', ccaa: 'CL' },
  { code: '25', name: 'Lleida', ccaa: 'CT' },
  { code: '26', name: 'La Rioja', ccaa: 'RI' },
  { code: '27', name: 'Lugo', ccaa: 'GA' },
  { code: '28', name: 'Madrid', ccaa: 'MD' },
  { code: '29', name: 'Málaga', ccaa: 'AN' },
  { code: '30', name: 'Murcia', ccaa: 'MC' },
  { code: '31', name: 'Navarra / Nafarroa', ccaa: 'NC' },
  { code: '32', name: 'Ourense', ccaa: 'GA' },
  { code: '33', name: 'Asturias', ccaa: 'AS' },
  { code: '34', name: 'Palencia', ccaa: 'CL' },
  { code: '35', name: 'Las Palmas', ccaa: 'CN' },
  { code: '36', name: 'Pontevedra', ccaa: 'GA' },
  { code: '37', name: 'Salamanca', ccaa: 'CL' },
  { code: '38', name: 'Santa Cruz de Tenerife', ccaa: 'CN' },
  { code: '39', name: 'Cantabria', ccaa: 'CB' },
  { code: '40', name: 'Segovia', ccaa: 'CL' },
  { code: '41', name: 'Sevilla', ccaa: 'AN' },
  { code: '42', name: 'Soria', ccaa: 'CL' },
  { code: '43', name: 'Tarragona', ccaa: 'CT' },
  { code: '44', name: 'Teruel', ccaa: 'AR' },
  { code: '45', name: 'Toledo', ccaa: 'CM' },
  { code: '46', name: 'València / Valencia', ccaa: 'VC' },
  { code: '47', name: 'Valladolid', ccaa: 'CL' },
  { code: '48', name: 'Bizkaia', ccaa: 'PV' },
  { code: '49', name: 'Zamora', ccaa: 'CL' },
  { code: '50', name: 'Zaragoza', ccaa: 'AR' },
  { code: '51', name: 'Ceuta', ccaa: 'CE' },
  { code: '52', name: 'Melilla', ccaa: 'ML' }
]

export function normalizarCodigoProvincia(raw) {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  if (!/^\d{1,2}$/.test(s)) return ''
  return s.padStart(2, '0')
}

export function nombreComunidad(code) {
  if (!code) return ''
  const c = String(code).toUpperCase()
  return COMUNIDADES_AUTONOMAS.find((x) => x.code === c)?.name || ''
}

export function nombreProvincia(code) {
  const n = normalizarCodigoProvincia(code)
  if (!n) return ''
  return PROVINCIAS_ES.find((p) => p.code === n)?.name || ''
}

export function provinciasPorComunidad(ccaaCode) {
  if (!ccaaCode) return []
  const c = String(ccaaCode).toUpperCase()
  return PROVINCIAS_ES.filter((p) => p.ccaa === c).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Si el valor guardado parece código INE de provincia, devuelve la CCAA correspondiente. */
export function inferirCcaaDesdeProvincia(provinciaRaw) {
  const n = normalizarCodigoProvincia(provinciaRaw)
  if (!n) return ''
  return PROVINCIAS_ES.find((p) => p.code === n)?.ccaa || ''
}

/** Hay datos de zona para mostrar en tarjetas (CCAA/provincia o país distinto de ES). */
export function tieneZonaSalida(route) {
  if (!route) return false
  if (route.ubicacion_region || route.ubicacion_ciudad) return true
  return !!(route.ubicacion_pais && route.ubicacion_pais !== 'ES')
}
