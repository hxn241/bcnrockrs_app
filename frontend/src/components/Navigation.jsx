import { Link } from 'react-router-dom'
import { resolveUploadUrl } from '../utils/apiBaseUrl'
import '../styles/Navigation.css'

export default function Navigation({ user, onLogout }) {
  const displayName = user?.full_name?.trim() || user?.username || 'Usuario'
  const avatarSrc = user?.avatar_url ? resolveUploadUrl(user.avatar_url) : ''

  return (
    <div className="nav-shell">
      <nav className="navigation">
        <div className="nav-container">
          <ul className="nav-menu">
            <li>
              <Link to="/dashboard">Rutas</Link>
            </li>
            <li>
              <Link to="/calendario">Calendario</Link>
            </li>
            <li>
              <Link to="/historico">Histórico</Link>
            </li>
            <li>
              <Link to="/grupos">Grupos</Link>
            </li>
            <li>
              <Link to="/catalogo">Catálogo de rutas</Link>
            </li>
            <li className="user-info">
              <Link
                to="/perfil"
                className="nav-user-btn nav-user-profile-link"
                title="Mi perfil"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="nav-user-avatar" />
                ) : null}
                <span className="nav-user-label">{displayName}</span>
              </Link>
            </li>
            <li>
              <button className="logout-btn" onClick={onLogout}>
                Salir
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <div className="nav-beta-banner" role="note">
        <span className="nav-beta-banner-badge">Beta</span>
        Early release — you may encounter issues or changes as we improve the experience.
      </div>
    </div>
  )
}
