import { Link } from 'react-router-dom'
import '../styles/Navigation.css'

export default function Navigation({ user, onLogout }) {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-logo">
          <Link to="/dashboard">🏍️ BCN Rockers</Link>
        </div>

        <ul className="nav-menu">
          <li>
            <Link to="/dashboard">Rutas</Link>
          </li>
          <li>
            <Link to="/calendario">Calendario</Link>
          </li>
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
