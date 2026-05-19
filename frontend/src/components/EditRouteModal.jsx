import { useState, useEffect } from 'react'
import { rutasService } from '../services/api'
import GoogleMapsLinkInfo from './GoogleMapsLinkInfo'
import {
  COMUNIDADES_AUTONOMAS,
  provinciasPorComunidad,
  normalizarCodigoProvincia
} from '../constants/espanaUbicacion'
import '../styles/PublishRouteModal.css'

function buildForm(ruta, mode) {
  const src = ruta.map_source || 'google'
  return {
    nombre: mode === 'duplicate' ? `Copia de ${ruta.nombre}` : ruta.nombre,
    map_source: src,
    link_ruta: src === 'osm' ? '' : ruta.link_ruta || '',
    link_encuentro: ruta.link_encuentro || '',
    link_restaurante: ruta.link_restaurante || '',
    ubicacionCcaa: ruta.ubicacion_region || '',
    ubicacionProvincia: normalizarCodigoProvincia(ruta.ubicacion_ciudad) || ''
  }
}

export default function EditRouteModal({ ruta, mode, onClose, onSave }) {
  const [form, setForm] = useState(() => buildForm(ruta, mode))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const provinciasCat = provinciasPorComunidad(form.ubicacionCcaa)

  useEffect(() => {
    setForm(buildForm(ruta, mode))
    setError('')
  }, [ruta.id, mode, ruta.nombre, ruta.link_ruta, ruta.link_encuentro, ruta.link_restaurante, ruta.ubicacion_region, ruta.ubicacion_ciudad, ruta.map_source])

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.nombre?.trim()) {
      setError('El nombre de la ruta es obligatorio.')
      return
    }
    if (form.map_source === 'google' && !form.link_encuentro?.trim()) {
      setError('Para rutas de Google Maps el punto de encuentro (enlace) es obligatorio.')
      return
    }
    if (form.map_source !== 'osm' && !form.link_ruta?.trim()) {
      setError('El enlace del recorrido (Google Maps) es obligatorio para rutas de Google.')
      return
    }
    const prov = normalizarCodigoProvincia(form.ubicacionProvincia)
    if (!form.ubicacionCcaa.trim() || !prov) {
      setError('Indica comunidad autónoma y provincia de la plantilla.')
      return
    }

    try {
      setLoading(true)
      const payload = {
        nombre: form.nombre.trim(),
        link_encuentro: form.link_encuentro.trim(),
        link_restaurante: form.link_restaurante.trim() || null,
        ubicacion_region: form.ubicacionCcaa.trim().toUpperCase(),
        ubicacion_ciudad: prov
      }
      if (form.map_source === 'osm') {
        payload.link_ruta = ''
      } else {
        payload.link_ruta = form.link_ruta.trim()
      }
      if (mode === 'edit') {
        await rutasService.updateRoute(ruta.id, payload)
      } else {
        const createPayload = { ...payload }
        if (form.map_source === 'osm') {
          createPayload.map_source = 'osm'
          createPayload.recorrido_geojson = ruta.recorrido_geojson
        } else {
          createPayload.map_source = 'google'
        }
        await rutasService.createRoute(createPayload)
      }
      onSave()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar la ruta')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'edit' ? `Editar: ${ruta.nombre}` : `Duplicar: ${ruta.nombre}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="mode-content">
          <div className="publish-filtro-catalogo-block">
            <p className="publish-ubicacion-title">Zona en catálogo (España) *</p>
            <div className="form-group">
              <label htmlFor="edit-ruta-ccaa">Comunidad autónoma</label>
              <select
                id="edit-ruta-ccaa"
                className="publish-modal-control"
                value={form.ubicacionCcaa}
                onChange={(e) => {
                  setForm({ ...form, ubicacionCcaa: e.target.value, ubicacionProvincia: '' })
                }}
              >
                <option value="">— Elige —</option>
                {COMUNIDADES_AUTONOMAS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="edit-ruta-provincia">Provincia</label>
              <select
                id="edit-ruta-provincia"
                className="publish-modal-control"
                value={form.ubicacionProvincia}
                onChange={handleChange('ubicacionProvincia')}
                disabled={!form.ubicacionCcaa}
              >
                <option value="">— Elige —</option>
                {provinciasCat.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-ruta-nombre">Nombre de la ruta *</label>
            <input
              id="edit-ruta-nombre"
              type="text"
              value={form.nombre}
              onChange={handleChange('nombre')}
              placeholder="Ej. Gavà - Begues - Subirats…"
              autoComplete="off"
            />
            <p className="form-hint-edit-ruta">
              Es el título que verán en el calendario y en las rutas publicadas.
            </p>
          </div>

          <div className="form-group">
            <div className="form-label-with-gmaps-info">
              <label htmlFor="edit-ruta-link">Enlace del recorrido (Google Maps) *</label>
              <GoogleMapsLinkInfo />
            </div>
            <input
              id="edit-ruta-link"
              type="url"
              value={form.link_ruta}
              onChange={handleChange('link_ruta')}
              placeholder="https://maps.app.goo.gl/..."
              disabled={form.map_source === 'osm'}
            />
            {form.map_source === 'osm' ? (
              <p className="form-hint-edit-ruta">
                Esta plantilla usa recorrido en mapa abierto; edita el trazo desde «Crear ruta (mapa)» si añadimos
                editor aquí más adelante.
              </p>
            ) : null}
          </div>

          <div className="form-group">
            <div className="form-label-with-gmaps-info">
              <label htmlFor="edit-ruta-encuentro">
                Punto de encuentro (enlace){form.map_source === 'google' ? ' *' : ' (opcional)'}
              </label>
              {form.map_source === 'google' ? <GoogleMapsLinkInfo /> : null}
            </div>
            <input
              id="edit-ruta-encuentro"
              type="url"
              value={form.link_encuentro}
              onChange={handleChange('link_encuentro')}
              placeholder={
                form.map_source === 'osm'
                  ? 'Opcional: Maps, OSM… Vacío → primer punto del recorrido'
                  : 'https://maps.app.goo.gl/...'
              }
            />
            {form.map_source === 'osm' ? (
              <p className="form-hint-edit-ruta">
                Si lo dejas vacío, al guardar se usará un enlace OpenStreetMap al inicio del recorrido dibujado.
              </p>
            ) : null}
          </div>

          <div className="form-group">
            <div className="form-label-with-gmaps-info">
              <label htmlFor="edit-ruta-rest">Restaurante (enlace opcional)</label>
              <GoogleMapsLinkInfo />
            </div>
            <input
              id="edit-ruta-rest"
              type="url"
              value={form.link_restaurante}
              onChange={handleChange('link_restaurante')}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Guardando...' : mode === 'edit' ? 'Guardar Cambios' : 'Crear Copia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
