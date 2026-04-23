import { useState } from 'react'
import { rutasService } from '../services/api'
import '../styles/PublishRouteModal.css'

export default function EditRouteModal({ ruta, mode, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: mode === 'duplicate' ? `Copia de ${ruta.nombre}` : ruta.nombre,
    link_ruta: ruta.link_ruta || '',
    link_encuentro: ruta.link_encuentro || '',
    link_restaurante: ruta.link_restaurante || ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!form.nombre || !form.link_ruta || !form.link_encuentro) {
      setError('Nombre, link de ruta y punto de encuentro son obligatorios')
      return
    }

    try {
      setLoading(true)
      if (mode === 'edit') {
        await rutasService.updateRoute(ruta.id, form)
      } else {
        await rutasService.createRoute(form)
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
            <label>Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={handleChange('nombre')}
            />
          </div>

          <div className="form-group">
            <label>Link de la Ruta (Google Maps) *</label>
            <input
              type="url"
              value={form.link_ruta}
              onChange={handleChange('link_ruta')}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>

          <div className="form-group">
            <label>Punto de Encuentro (Link) *</label>
            <input
              type="url"
              value={form.link_encuentro}
              onChange={handleChange('link_encuentro')}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>

          <div className="form-group">
            <label>Restaurante (Link Opcional)</label>
            <input
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
