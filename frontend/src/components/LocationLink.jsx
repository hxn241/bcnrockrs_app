import { useState, useEffect } from 'react'

export default function LocationLink({ url, title = '📍 Punto de Encuentro' }) {
  const [locationName, setLocationName] = useState('Cargando...')

  useEffect(() => {
    if (!url) {
      setLocationName('No especificado')
      return
    }

    const fetchLocationName = async () => {
      try {
        const encodedUrl = encodeURIComponent(url)
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
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

  if (!url) {
    return <span>{title}: No especificado</span>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: 0,
        marginBottom: '12px',
        color: '#D97B3C',
        textDecoration: 'none',
        fontWeight: 500,
        transition: 'all 0.2s',
        fontSize: '13px'
      }}
      onMouseEnter={(e) => {
        e.target.style.color = '#c97833'
      }}
      onMouseLeave={(e) => {
        e.target.style.color = '#D97B3C'
      }}
    >
      {locationName}
    </a>
  )
}
