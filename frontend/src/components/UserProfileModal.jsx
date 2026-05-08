import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import '../styles/UserProfileModal.css'

export default function UserProfileModal({ open, onClose }) {
  const { user, updateProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [motoMarca, setMotoMarca] = useState('')
  const [motoModelo, setMotoModelo] = useState('')
  const [motoAnio, setMotoAnio] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !user) return
    setFullName(user.full_name || '')
    setMotoMarca(user.moto_marca || '')
    setMotoModelo(user.moto_modelo || '')
    setMotoAnio(user.moto_anio != null ? String(user.moto_anio) : '')
    setError('')
  }, [open, user])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const anioTrim = motoAnio.trim()
    let moto_anio = null
    if (anioTrim !== '') {
      const n = parseInt(anioTrim, 10)
      if (Number.isNaN(n) || n < 1950 || n > 2100) {
        setError('El año de la moto debe ser un número entre 1950 y 2100.')
        setSaving(false)
        return
      }
      moto_anio = n
    }
    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        moto_marca: motoMarca.trim() || null,
        moto_modelo: motoModelo.trim() || null,
        moto_anio
      })
      onClose()
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'No se pudo guardar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2 id="profile-modal-title">Tu perfil</h2>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="profile-modal-hint">
          Usuario de acceso: <strong>{user?.username}</strong> (no editable aquí).
        </p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="profile-modal-form">
          <div className="form-group">
            <label htmlFor="profile-full-name">Nombre</label>
            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              placeholder="Tu nombre o apodo visible"
              disabled={saving}
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-moto-marca">Marca de la moto</label>
            <input
              id="profile-moto-marca"
              type="text"
              value={motoMarca}
              onChange={(e) => setMotoMarca(e.target.value)}
              maxLength={100}
              placeholder="Ej: Yamaha"
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-moto-modelo">Modelo</label>
            <input
              id="profile-moto-modelo"
              type="text"
              value={motoModelo}
              onChange={(e) => setMotoModelo(e.target.value)}
              maxLength={120}
              placeholder="Ej: MT-07"
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-moto-anio">Año</label>
            <input
              id="profile-moto-anio"
              type="number"
              min={1950}
              max={2100}
              value={motoAnio}
              onChange={(e) => setMotoAnio(e.target.value)}
              placeholder="Opcional"
              disabled={saving}
            />
          </div>
          <div className="profile-modal-actions">
            <button type="button" className="btn-secondary-profile" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary-profile" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
