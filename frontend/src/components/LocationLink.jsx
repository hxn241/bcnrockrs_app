import { useState, useEffect } from 'react'
import { getApiBaseUrl } from '../utils/apiBaseUrl'
import '../styles/LocationLink.css'

export default function LocationLink({
  url,
  title = '📍 Punto de Encuentro',
  /** Si es true: "Punto de encuentro: {nombre enlace}" en un solo bloque (modal detalle) */
  layout = 'default',
  /** Texto del prefijo (sin dos puntos; se añaden en el estilo) */
  label = 'Punto de encuentro'
}) {
  const [locationName, setLocationName] = useState('Cargando...')

  useEffect(() => {
    if (!url) {
      setLocationName('No especificado')
      return
    }

    const fetchLocationName = async () => {
      try {
        const encodedUrl = encodeURIComponent(url)
        const apiUrl = getApiBaseUrl()
        const response = await fetch(
          `${apiUrl}/maps/name/${encodedUrl}`
        )
        const data = await response.json()
        setLocationName(data.name || 'Ubicación')
      } catch (err) {
        console.error('Error al obtener nombre de ubicación:', err)
        setLocationName('Ubicación')
      }
    }

    fetchLocationName()
  }, [url])

  if (layout === 'inline') {
    if (!url) {
      return (
        <p>
          <strong>📍 {label}:</strong>{' '}
          <span className="location-link-missing">No especificado</span>
        </p>
      )
    }
    return (
      <p>
        <strong>📍 {label}:</strong>{' '}
        <a
          className="location-link-inline-anchor"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {locationName}
        </a>
      </p>
    )
  }

  if (!url) {
    return <span>{title}: No especificado</span>
  }

  return (
    <a
      href={url}
      className="location-link-block"
      target="_blank"
      rel="noopener noreferrer"
    >
      {locationName}
    </a>
  )
}
