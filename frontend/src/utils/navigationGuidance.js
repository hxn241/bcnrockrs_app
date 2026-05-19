/** Distancia en metros entre dos puntos WGS84 (aprox. esfera). */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLng = toR(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceMeters(m) {
  if (m == null || !Number.isFinite(m)) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1)} km`
}

/** ETA legible a partir de segundos (respuesta OSRM/Valhalla). */
export function formatDurationSeconds(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 1) return '< 1 min'
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return mm ? `${h} h ${mm} min` : `${h} h`
}

/**
 * Texto en español a partir de una maniobra OSRM (route.steps).
 * @param {object} step — campos snake_case del API (maneuver_type, maneuver_modifier, …)
 */
export function instructionEs(step) {
  if (!step) return 'Continúa por la ruta'
  if (step.source === 'valhalla' && step.instruction_en?.trim()) {
    return step.instruction_en.trim()
  }
  const name = (step.street_name || '').trim()
  const via = name ? ` por ${name}` : ''
  const mod = step.maneuver_modifier
  const typ = step.maneuver_type

  if (typ === 'depart') return name ? `Inicia el recorrido por ${name}` : 'Inicia el recorrido'
  if (typ === 'arrive') return 'Has llegado al destino'

  const turn = (prefix) => `${prefix}${via}`

  if (typ === 'turn' || typ === 'end of road' || typ === 'new name') {
    if (mod === 'left') return turn('Gira a la izquierda')
    if (mod === 'right') return turn('Gira a la derecha')
    if (mod === 'sharp left') return turn('Gira fuerte a la izquierda')
    if (mod === 'sharp right') return turn('Gira fuerte a la derecha')
    if (mod === 'slight left') return turn('Mantén la izquierda')
    if (mod === 'slight right') return turn('Mantén la derecha')
    if (mod === 'straight') return turn('Continúa recto')
    if (mod === 'uturn') return turn('Cambia de sentido')
  }
  if (typ === 'fork') {
    if (mod === 'left') return turn('En la bifurcación, mantén la izquierda')
    if (mod === 'right') return turn('En la bifurcación, mantén la derecha')
    return turn('En la bifurcación')
  }
  if (typ === 'merge') {
    if (mod === 'left') return turn('Incorpórate a la izquierda')
    if (mod === 'right') return turn('Incorpórate a la derecha')
    return 'Incorpórate a la vía'
  }
  if (typ === 'on ramp' || typ === 'off ramp') return turn('Toma el ramal')
  if (typ === 'roundabout' || typ === 'rotary') return turn('Entra en la rotonda')
  if (typ === 'roundabout turn') return turn('En la rotonda')
  if (typ === 'exit roundabout') return turn('Sal de la rotonda')
  if (typ === 'notification') {
    if (mod === 'sharp left') return turn('Atención: curva cerrada a la izquierda')
    if (mod === 'sharp right') return turn('Atención: curva cerrada a la derecha')
  }
  if (typ === 'continue' || typ === 'straight') return turn('Continúa de frente')

  if (step.instruction_en) return step.instruction_en
  return name ? `Continúa${via}` : 'Continúa por la ruta'
}
