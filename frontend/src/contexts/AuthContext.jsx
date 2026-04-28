import { createContext, useState, useContext, useEffect } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const register = async (username, email, password, fullName, motoMarca, motoModelo, motoAnio) => {
    try {
      setError(null)
      const response = await authService.register(
        username,
        email,
        password,
        fullName,
        motoMarca,
        motoModelo,
        motoAnio
      )
      return response.data
    } catch (err) {
      setError(err.response?.data?.detail || 'Error en registro')
      throw err
    }
  }

  const login = async (username, password) => {
    try {
      setError(null)
      const response = await authService.login(username, password)
      const { access_token, user: userData } = response.data
      
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      
      return userData
    } catch (err) {
      setError(err.response?.data?.detail || 'Error en login')
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
