import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/api'
import { resolveUploadUrl } from '../utils/apiBaseUrl'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'
import '../styles/Profile.css'

export default function Profile() {
  const { user, logout, updateProfile, refreshUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const motoFileRef = useRef(null)

  const [fullName, setFullName] = useState('')
  const [motoMarca, setMotoMarca] = useState('')
  const [motoModelo, setMotoModelo] = useState('')
  const [motoAnio, setMotoAnio] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [motoSlotPicking, setMotoSlotPicking] = useState(null)
  const [motoBusySlot, setMotoBusySlot] = useState(null)
  const [error, setError] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [motoError, setMotoError] = useState('')

  useEffect(() => {
    refreshUser().catch(() => {})
  }, [refreshUser])

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name || '')
    setMotoMarca(user.moto_marca || '')
    setMotoModelo(user.moto_modelo || '')
    setMotoAnio(user.moto_anio != null ? String(user.moto_anio) : '')
    setBio(user.bio || '')
    setError('')
    setAvatarError('')
    setMotoError('')
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const avatarSrc = user?.avatar_url ? resolveUploadUrl(user.avatar_url) : ''

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarBusy(true)
    setAvatarError('')
    try {
      await authService.uploadAvatar(file)
      await refreshUser()
    } catch (err) {
      setAvatarError(formatApiErrorMessage(err, 'No se pudo subir la imagen.'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarRemove = async () => {
    if (!user?.avatar_url) return
    setAvatarBusy(true)
    setAvatarError('')
    try {
      await authService.deleteAvatar()
      await refreshUser()
    } catch (err) {
      setAvatarError(formatApiErrorMessage(err, 'No se pudo quitar la foto.'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const beginMotoPick = (slot) => {
    if (motoBusySlot != null) return
    setMotoSlotPicking(slot)
    motoFileRef.current?.click()
  }

  const handleMotoFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const slot = motoSlotPicking
    setMotoSlotPicking(null)
    if (!file || slot == null) return
    setMotoBusySlot(slot)
    setMotoError('')
    try {
      await authService.uploadMotoFoto(slot, file)
      await refreshUser()
    } catch (err) {
      setMotoError(formatApiErrorMessage(err, 'No se pudo subir la foto de moto.'))
    } finally {
      setMotoBusySlot(null)
    }
  }

  const removeMoto = async (slot) => {
    const key = `moto_foto_${slot}_url`
    if (!user?.[key]) return
    setMotoBusySlot(slot)
    setMotoError('')
    try {
      await authService.deleteMotoFoto(slot)
      await refreshUser()
    } catch (err) {
      setMotoError(formatApiErrorMessage(err, 'No se pudo quitar la foto.'))
    } finally {
      setMotoBusySlot(null)
    }
  }

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
        moto_anio,
        bio: bio.trim() || null
      })
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'No se pudo guardar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  const motoSlotUrl = (slot) => {
    const k = `moto_foto_${slot}_url`
    const url = user?.[k]
    return url ? resolveUploadUrl(url) : ''
  }

  return (
    <div className="profile-page">
      <Navigation user={user} onLogout={handleLogout} />
      <main className="profile-main">
        <div className="profile-card">
          <h1 className="profile-title">Mi perfil</h1>
          <p className="profile-hint">
            Usuario de acceso: <strong>{user?.username}</strong> · Email:{' '}
            <strong>{user?.email}</strong>
            <span className="profile-hint-note"> (no editables aquí)</span>
          </p>
          {user?.id ? (
            <p className="profile-preview-link-wrap">
              <Link to={`/u/${user.id}`}>Ver cómo ven tu perfil el resto de usuarios</Link>
            </p>
          ) : null}

          <section className="profile-avatar-section" aria-labelledby="profile-photo-heading">
            <h2 id="profile-photo-heading" className="profile-section-title">
              Foto de perfil
            </h2>
            {avatarError && <div className="profile-alert">{avatarError}</div>}
            <div className="profile-avatar-row">
              <div className="profile-avatar-preview">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="profile-avatar-img" />
                ) : (
                  <div className="profile-avatar-placeholder" aria-hidden>
                    {user?.username?.slice(0, 1)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="profile-avatar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="profile-file-input"
                  onChange={handleAvatarPick}
                  disabled={avatarBusy}
                />
                <button
                  type="button"
                  className="btn-profile-secondary"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarBusy ? 'Subiendo…' : 'Elegir imagen'}
                </button>
                {user?.avatar_url ? (
                  <button
                    type="button"
                    className="btn-profile-danger"
                    disabled={avatarBusy}
                    onClick={handleAvatarRemove}
                  >
                    Quitar foto
                  </button>
                ) : null}
                <p className="profile-avatar-help">JPEG, PNG o WebP. Mismo límite de tamaño que el resto de subidas.</p>
              </div>
            </div>
          </section>

          <section className="profile-moto-gallery-section" aria-labelledby="profile-moto-fotos-heading">
            <h2 id="profile-moto-fotos-heading" className="profile-section-title">
              Fotos de tus motos (hasta 3)
            </h2>
            {motoError && <div className="profile-alert">{motoError}</div>}
            <input
              ref={motoFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="profile-file-input"
              onChange={handleMotoFile}
              disabled={motoBusySlot != null}
            />
            <div className="profile-moto-edit-grid">
              {[1, 2, 3].map((slot) => {
                const src = motoSlotUrl(slot)
                const busy = motoBusySlot === slot
                return (
                  <div key={slot} className="profile-moto-edit-slot">
                    <div className="profile-moto-edit-thumb">
                      {src ? (
                        <img src={src} alt={`Moto ${slot}`} />
                      ) : (
                        <span className="profile-moto-edit-placeholder">Vacío</span>
                      )}
                    </div>
                    <div className="profile-moto-edit-actions">
                      <button
                        type="button"
                        className="btn-profile-secondary btn-profile-compact"
                        disabled={busy || motoBusySlot != null}
                        onClick={() => beginMotoPick(slot)}
                      >
                        {busy ? '…' : src ? 'Cambiar' : 'Subir'}
                      </button>
                      {src ? (
                        <button
                          type="button"
                          className="btn-profile-danger btn-profile-compact"
                          disabled={busy || motoBusySlot != null}
                          onClick={() => removeMoto(slot)}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="profile-form-section" aria-labelledby="profile-data-heading">
            <h2 id="profile-data-heading" className="profile-section-title">
              Datos y descripción
            </h2>
            {error && <div className="profile-alert">{error}</div>}
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="profile-full-name">Nombre visible</label>
                <input
                  id="profile-full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  placeholder="Tu nombre o apodo"
                  disabled={saving}
                  autoComplete="name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="profile-bio">Descripción (opcional)</label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={600}
                  rows={4}
                  placeholder="Algo sobre ti, tus rutas favoritas…"
                  disabled={saving}
                  className="profile-textarea"
                />
                <span className="profile-char-hint">{bio.length}/600</span>
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
              <div className="profile-form-actions">
                <button type="submit" className="btn-profile-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
