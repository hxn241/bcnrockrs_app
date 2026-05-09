import { createContext, useState, useContext, useEffect, useCallback } from 'react'
import { authService } from '../services/api'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const persistUser = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

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
      setError(formatApiErrorMessage(err, 'Error en registro'))
      throw err
    }
  }

  const login = async (username, password) => {
    try {
      setError(null)
      const response = await authService.login(username, password)
      const { access_token, user: userData } = response.data
      
      localStorage.setItem('token', access_token)
      persistUser(userData)
      
      return userData
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Error en login'))
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateProfile = useCallback(async (payload) => {
    const response = await authService.updateMe(payload)
    persistUser(response.data)
    return response.data
  }, [persistUser])

  const refreshUser = useCallback(async () => {
    const response = await authService.getMe()
    persistUser(response.data)
    return response.data
  }, [persistUser])

  return (
    <AuthContext.Provider
      value={{ user, loading, error, register, login, logout, updateProfile, refreshUser, persistUser }}
    >
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
