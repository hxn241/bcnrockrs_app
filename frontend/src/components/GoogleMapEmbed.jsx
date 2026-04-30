import { useEffect, useState } from 'react'
import { getApiBaseUrl } from '../utils/apiBaseUrl'
import '../styles/GoogleMapEmbed.css'

export default function GoogleMapEmbed({ url, title }) {
  const [embedUrl, setEmbedUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) {
      setEmbedUrl(null)
      setError(null)
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setError(null)
    setEmbedUrl(null)

    const run = async () => {
      try {
        const encodedUrl = encodeURIComponent(url)
        const apiUrl = getApiBaseUrl()
        const response = await fetch(`${apiUrl}/maps/embed/${encodedUrl}`, {
          signal: ac.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (ac.signal.aborted) return
        if (!response.ok) {
          const detail = data.detail
          setError(
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((d) => d.msg || d).join(' ')
                : 'No se pudo generar el mapa del recorrido'
          )
          return
        }
        if (data.embed_url) {
          setEmbedUrl(data.embed_url)
        } else {
          setError('No se pudo obtener la URL del mapa')
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Error al obtener mapa:', err)
        setError('Error al cargar el mapa')
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false)
        }
      }
    }

    run()
    return () => ac.abort()
  }, [url])

  if (!url) {
    return <div className="map-empty">📍 Sin ubicación</div>
  }

  if (loading) {
    return <div className="map-loading">Cargando mapa...</div>
  }

  if (error) {
    return (
      <div className="google-map-embed">
        <h4>{title}</h4>
        <p className="map-error">{error}</p>
      </div>
    )
  }

  if (!embedUrl) {
    return (
      <div className="google-map-embed">
        <h4>{title}</h4>
        <p className="map-error">No se pudo cargar el mapa</p>
      </div>
    )
  }

  return (
    <div className="google-map-embed">
      <h4>{title}</h4>
      <div className="map-container">
        <iframe
          width="100%"
          height="300"
          style={{ border: 0, borderRadius: '8px', display: 'block' }}
          loading="lazy"
          allowFullScreen=""
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title={title}
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="map-link"
        >
          Abrir en Google Maps →
        </a>
      </div>
    </div>
  )
}
