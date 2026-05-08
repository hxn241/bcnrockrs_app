import { useState } from 'react'
import { Link } from 'react-router-dom'
import UserProfileModal from './UserProfileModal'
import '../styles/Navigation.css'

export default function Navigation({ user, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const displayName = user?.full_name?.trim() || user?.username || 'Usuario'

  return (
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
