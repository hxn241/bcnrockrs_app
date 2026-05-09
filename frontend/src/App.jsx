import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import CatalogoRutas from './pages/CatalogoRutas'
import HistoricoRutas from './pages/HistoricoRutas'
import Grupos from './pages/Grupos'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import HomeGate from './components/HomeGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/App.css'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/calendario" element={<PrivateRoute><Calendar /></PrivateRoute>} />
              <Route path="/historico" element={<PrivateRoute><HistoricoRutas /></PrivateRoute>} />
              <Route path="/grupos" element={<PrivateRoute><Grupos /></PrivateRoute>} />
              <Route path="/catalogo" element={<PrivateRoute><CatalogoRutas /></PrivateRoute>} />
              <Route path="/perfil" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/u/:userId" element={<PrivateRoute><PublicProfile /></PrivateRoute>} />

              <Route path="/" element={<HomeGate />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
