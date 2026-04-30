import { useState, useEffect } from 'react'
import { rutasService } from '../services/api'
import GoogleMapsLinkInfo from './GoogleMapsLinkInfo'
import '../styles/PublishRouteModal.css'

function buildForm(ruta, mode) {
  return {
    nombre: mode === 'duplicate' ? `Copia de ${ruta.nombre}` : ruta.nombre,
    link_ruta: ruta.link_ruta || '',
    link_encuentro: ruta.link_encuentro || '',
    link_restaurante: ruta.link_restaurante || ''
  }
}

export default function EditRouteModal({ ruta, mode, onClose, onSave }) {
  const [form, setForm] = useState(() => buildForm(ruta, mode))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setForm(buildForm(ruta, mode))
    setError('')
  }, [ruta.id, mode, ruta.nombre, ruta.link_ruta, ruta.link_encuentro, ruta.link_restaurante])

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.nombre?.trim() || !form.link_ruta?.trim() || !form.link_encuentro?.trim()) {
      setError('Nombre de la ruta, enlace del recorrido y punto de encuentro son obligatorios')
      return
    }

    try {
      setLoading(true)
      const payload = {
        nombre: form.nombre.trim(),
        link_ruta: form.link_ruta.trim(),
        link_encuentro: form.link_encuentro.trim(),
        link_restaurante: form.link_restaurante.trim() || null
      }
      if (mode === 'edit') {
        await rutasService.updateRoute(ruta.id, payload)
      } else {
        await rutasService.createRoute(payload)
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
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="mode-content">
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
            />
          </div>

          <div className="form-group">
            <div className="form-label-with-gmaps-info">
              <label htmlFor="edit-ruta-encuentro">Punto de encuentro (enlace) *</label>
              <GoogleMapsLinkInfo />
            </div>
            <input
              id="edit-ruta-encuentro"
              type="url"
              value={form.link_encuentro}
              onChange={handleChange('link_encuentro')}
              placeholder="https://maps.app.goo.gl/..."
            />
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
            <button className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Guardando...' : mode === 'edit' ? 'Guardar Cambios' : 'Crear Copia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
