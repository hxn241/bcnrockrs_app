import { Link } from 'react-router-dom'
import logo from '../assets/bcnrockers.png'
import '../styles/Navigation.css'

export default function Navigation({ user, onLogout }) {
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
          {user?.is_admin && (
            <li>
              <Link to="/catalogo">Catálogo de rutas</Link>
            </li>
          )}
          <li className="user-info">
            <span>{user?.username}</span>
          </li>
          <li>
            <button className="logout-btn" onClick={onLogout}>
              Salir
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}
