import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/bcnrockers.png'
import UserProfileModal from './UserProfileModal'
import '../styles/Navigation.css'

export default function Navigation({ user, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const displayName = user?.full_name?.trim() || user?.username || 'Usuario'

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-logo">
          <Link
            to="/dashboard"
            className="nav-logo-link"
            title="BCN ROCKRS — Inicio"
            aria-label="BCN ROCKRS, Pasión por las dos ruedas — Inicio"
          >
            <img src={logo} alt="" className="nav-logo-img" width={52} height={52} />
            <div className="nav-brand-panel" aria-hidden="true">
              <span className="nav-brand-title">BCN ROCKRS</span>
              <span className="nav-brand-tagline">Pasión por las dos ruedas</span>
            </div>
          </Link>
        </div>

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
            <button
              type="button"
              className="nav-user-btn"
              onClick={() => setProfileOpen(true)}
              title="Editar nombre y datos de la moto"
            >
              {displayName}
            </button>
          </li>
          <li>
            <button className="logout-btn" onClick={onLogout}>
              Salir
            </button>
          </li>
        </ul>
      </div>
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </nav>
  )
}
