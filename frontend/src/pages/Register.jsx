import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'
import logo from '../assets/kurvemaster-logo.png'
import '../styles/Auth.css'
import BetaNotice from '../components/BetaNotice'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [motoMarca, setMotoMarca] = useState('')
  const [motoModelo, setMotoModelo] = useState('')
  const [motoAnio, setMotoAnio] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { register } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    const mMarca = motoMarca.trim()
    const mModelo = motoModelo.trim()
    if (!mMarca || !mModelo) {
      setError('Indica la marca y el modelo de la moto')
      setLoading(false)
      return
    }

    const anio = Number.parseInt(String(motoAnio).trim(), 10)
    if (!Number.isFinite(anio) || anio < 1950 || anio > 2100) {
      setError('Indica un año de la moto válido (1950–2100)')
      setLoading(false)
      return
    }

    try {
      await register(username, email, password, fullName, mMarca, mModelo, anio)
      navigate('/login')
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Error en el registro'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-brand">
          <img src={logo} alt="KurveMaster" className="auth-logo" />
          <p className="auth-tagline">Ride Hard. Master Every Curve.</p>
        </div>
        <BetaNotice />
        <h2>Crear cuenta</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Marca de la moto</label>
            <input
              type="text"
              value={motoMarca}
              onChange={(e) => setMotoMarca(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label>Modelo</label>
            <input
              type="text"
              value={motoModelo}
              onChange={(e) => setMotoModelo(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label>Año de la moto</label>
            <input
              type="number"
              value={motoAnio}
              onChange={(e) => setMotoAnio(e.target.value)}
              min={1950}
              max={2100}
              required
              autoComplete="off"
              inputMode="numeric"
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <p className="auth-link">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
