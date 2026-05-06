import { useEffect, useState } from 'react'
import './GoogleMapsLinkInfo.css'

export const GOOGLE_MAPS_LINK_EXAMPLE = 'https://maps.app.goo.gl/BVCi69deyW51NrJE9'

export default function GoogleMapsLinkInfo() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className="gmaps-link-info-btn"
        aria-label="Cómo obtener el enlace desde Google Maps"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        i
      </button>

      {open && (
        <div
          className="gmaps-link-info-overlay"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="gmaps-link-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gmaps-link-info-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gmaps-link-info-dialog-head">
              <h3 id="gmaps-link-info-title">Enlaces de Google Maps</h3>
              <button
                type="button"
                className="gmaps-link-info-close"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="gmaps-link-info-body">
              <p>
                El enlace de la <strong>ruta</strong>, del <strong>punto de encuentro</strong> o del{' '}
                <strong>restaurante</strong> debe copiarse desde Google Maps (app o web), usando{' '}
                <strong>Copiar enlace</strong>. Así el formato será el correcto para esta aplicación.
              </p>
              <p className="gmaps-link-info-muted">
                Para rutas con varias paradas: crea la ruta en Indicaciones y pulsa «Copiar enlace» en el
                panel lateral (no basta con copiar la URL larga de la barra del navegador si no coincide).
              </p>

              <figure className="gmaps-link-info-figure">
                <img
                  src="/images/google-maps-copiar-enlace.png"
                  alt="Panel lateral de Google Maps con la ruta y el botón Copiar enlace resaltado."
                  loading="lazy"
                />
                <figcaption>Ejemplo: botón «Copiar enlace» en el panel de la ruta.</figcaption>
              </figure>

              <p className="gmaps-link-info-format">
                Formato recomendado (enlace corto), por ejemplo:
              </p>
              <code className="gmaps-link-info-example">{GOOGLE_MAPS_LINK_EXAMPLE}</code>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
