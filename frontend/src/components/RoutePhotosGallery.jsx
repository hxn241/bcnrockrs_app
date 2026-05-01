import { useState, useEffect, useRef, useCallback } from 'react'
import { rutasPublicadasService } from '../services/api'
import { resolveUploadUrl } from '../utils/apiBaseUrl'
import '../styles/RoutePhotosGallery.css'

export default function RoutePhotosGallery({ rutaPublicadaId, user }) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [editFotosMode, setEditFotosMode] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const fileRef = useRef(null)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const { data } = await rutasPublicadasService.getFotos(rutaPublicadaId)
      setFotos(data)
    } catch (err) {
      setError('No se pudieron cargar las fotos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [rutaPublicadaId])

  const hasOwnPhotos =
    Boolean(user) &&
    fotos.some((f) => Number(f.user_id) === Number(user.id))

  const showEditFotosToggle =
    Boolean(user) &&
    fotos.length > 0 &&
    (hasOwnPhotos || user.is_admin === true)

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null || fotos.length === 0) return null
      return i <= 0 ? fotos.length - 1 : i - 1
    })
  }, [fotos.length])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null || fotos.length === 0) return null
      return i >= fotos.length - 1 ? 0 : i + 1
    })
  }, [fotos.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightboxIndex, closeLightbox, goPrev, goNext])

  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex >= fotos.length) {
      setLightboxIndex(fotos.length ? fotos.length - 1 : null)
    }
  }, [fotos.length, lightboxIndex])

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    try {
      setUploading(true)
      setError('')
      await rutasPublicadasService.uploadFoto(rutaPublicadaId, file)
      await load()
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const onDelete = async (fotoId) => {
    if (!globalThis.confirm('¿Eliminar esta foto?')) return
    try {
      setError('')
      setLightboxIndex(null)
      await rutasPublicadasService.deleteFoto(rutaPublicadaId, fotoId)
      await load()
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'No se pudo eliminar')
    }
  }

  const openLightbox = (index) => setLightboxIndex(index)

  const lightboxFoto = lightboxIndex !== null ? fotos[lightboxIndex] : null
  const lightboxSrc = lightboxFoto ? resolveUploadUrl(lightboxFoto.url) : ''

  return (
    <div className="route-photos-gallery">
      <div className="route-photos-head">
        <h3>📷 Fotos de la salida</h3>
        {user && (
          <span className="route-photos-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="route-photos-file-input"
              onChange={onPickFile}
              disabled={uploading}
            />
            <button
              type="button"
              className="btn btn-secondary route-photos-upload-btn"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Subiendo…' : 'Subir foto'}
            </button>
            {showEditFotosToggle && (
              <button
                type="button"
                className={`btn route-photos-edit-toggle ${editFotosMode ? 'route-photos-edit-toggle-active' : ''}`}
                onClick={() => setEditFotosMode((v) => !v)}
              >
                {editFotosMode ? 'Listo' : 'Editar fotos'}
              </button>
            )}
          </span>
        )}
      </div>

      <p className="route-photos-hint">
        Toca una miniatura para verla grande; fuera de la imagen o Escape para volver. JPEG, PNG o WebP.
      </p>

      {error && <div className="error-message route-photos-error">{error}</div>}

      {loading ? (
        <p className="route-photos-loading">Cargando fotos…</p>
      ) : fotos.length === 0 ? (
        <p className="route-photos-empty">Aún no hay fotos. ¡Sé el primero en compartir una!</p>
      ) : (
        <ul className="route-photos-grid">
          {fotos.map((f, index) => {
            const src = resolveUploadUrl(f.url)
            const isMine = user && Number(f.user_id) === Number(user.id)
            const canDelete =
              user &&
              (isMine || user.is_admin === true)
            return (
              <li key={f.id} className="route-photos-item">
                <button
                  type="button"
                  className="route-photos-thumb"
                  onClick={() => openLightbox(index)}
                  aria-label={`Ampliar foto de ${f.user?.username || 'usuario'}`}
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
                {editFotosMode && canDelete ? (
                  <div className="route-photos-edit-row">
                    <button
                      type="button"
                      className="route-photos-quitar-btn"
                      onClick={() => onDelete(f.id)}
                    >
                      Quitar foto
                    </button>
                  </div>
                ) : (
                  <div className="route-photos-caption">{f.user?.username || `Usuario ${f.user_id}`}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {lightboxFoto && (
        <div
          className="route-photos-lightbox-backdrop"
          role="presentation"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="route-photos-lightbox-close"
            aria-label="Cerrar"
            onClick={(e) => {
              e.stopPropagation()
              closeLightbox()
            }}
          >
            ✕
          </button>
          <button
            type="button"
            className="route-photos-lightbox-arrow route-photos-lightbox-prev"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
          >
            ‹
          </button>
          <div
            className="route-photos-lightbox-stage"
            role="dialog"
            aria-modal="true"
            aria-label="Visor de foto"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={lightboxSrc} alt="" className="route-photos-lightbox-img" />
            <p className="route-photos-lightbox-meta">
              {lightboxFoto.user?.username || `Usuario ${lightboxFoto.user_id}`} ·{' '}
              {lightboxIndex + 1} / {fotos.length}
            </p>
          </div>
          <button
            type="button"
            className="route-photos-lightbox-arrow route-photos-lightbox-next"
            aria-label="Foto siguiente"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
