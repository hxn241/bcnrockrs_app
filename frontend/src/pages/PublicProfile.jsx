import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { useAuth } from '../contexts/AuthContext'
import { usersService } from '../services/api'
import { resolveUploadUrl } from '../utils/apiBaseUrl'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'
import '../styles/PublicProfile.css'

function MotoThumb({ url, alt }) {
  const src = url ? resolveUploadUrl(url) : ''
  if (!src) return <div className="public-profile-moto-empty" aria-hidden>—</div>
  return <img src={src} alt={alt} className="public-profile-moto-img" />
}

export default function PublicProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const id = parseInt(userId, 10)

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setError('Usuario no válido.')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await usersService.getPublicProfile(id)
        if (!cancelled) setProfile(res.data)
      } catch (e) {
        if (!cancelled) setError(formatApiErrorMessage(e, 'No se pudo cargar el perfil.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isMine =
    currentUser && profile && Number(currentUser.id) === Number(profile.id)
  const avatarSrc = profile?.avatar_url ? resolveUploadUrl(profile.avatar_url) : ''

  const motoLine = [profile?.moto_marca, profile?.moto_modelo, profile?.moto_anio]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="public-profile-page">
      <Navigation user={currentUser} onLogout={handleLogout} />
      <main className="public-profile-main">
        <p className="public-profile-back">
          <Link to="/grupos">← Volver a grupos</Link>
          {isMine && (
            <>
              {' · '}
              <Link to="/perfil">Editar mi perfil</Link>
            </>
          )}
        </p>

        {loading && <p className="public-profile-muted">Cargando…</p>}
        {error && !loading && <div className="public-profile-alert">{error}</div>}

        {!loading && profile && (
          <div className="public-profile-card">
            <div className="public-profile-header">
              <div className="public-profile-avatar-wrap">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="public-profile-avatar" />
                ) : (
                  <div className="public-profile-avatar-placeholder" aria-hidden>
                    {profile.username?.slice(0, 1)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div>
                <h1 className="public-profile-name">
                  {profile.full_name?.trim() || profile.username}
                </h1>
                <p className="public-profile-username">@{profile.username}</p>
                {motoLine ? <p className="public-profile-moto">{motoLine}</p> : null}
              </div>
            </div>

            {profile.bio?.trim() ? (
              <section className="public-profile-section">
                <h2 className="public-profile-section-title">Sobre mí</h2>
                <p className="public-profile-bio">{profile.bio.trim()}</p>
              </section>
            ) : null}

            <section className="public-profile-section">
              <h2 className="public-profile-section-title">Motos en fotos</h2>
              <div className="public-profile-moto-grid">
                <MotoThumb url={profile.moto_foto_1_url} alt="Moto 1" />
                <MotoThumb url={profile.moto_foto_2_url} alt="Moto 2" />
                <MotoThumb url={profile.moto_foto_3_url} alt="Moto 3" />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
