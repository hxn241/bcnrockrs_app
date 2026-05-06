import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import CatalogoRutas from './pages/CatalogoRutas'
import HistoricoRutas from './pages/HistoricoRutas'
import Grupos from './pages/Grupos'
import './styles/App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/calendario" element={<PrivateRoute><Calendar /></PrivateRoute>} />
          <Route path="/historico" element={<PrivateRoute><HistoricoRutas /></PrivateRoute>} />
          <Route path="/grupos" element={<PrivateRoute><Grupos /></PrivateRoute>} />
          <Route path="/catalogo" element={<PrivateRoute><CatalogoRutas /></PrivateRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
