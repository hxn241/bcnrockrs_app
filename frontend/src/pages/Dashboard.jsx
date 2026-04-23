import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasPublicadasService } from '../services/api'
import RouteDetailModal from '../components/RouteDetailModal'
import Navigation from '../components/Navigation'
import '../styles/Dashboard.css'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [showRouteDetail, setShowRouteDetail] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState({})
  const navigate = useNavigate()

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }))
  }

  useEffect(() => {
    loadRoutes()
  }, [])

  const loadRoutes = async () => {
    try {
      setLoading(true)
      const response = await rutasPublicadasService.getPublishedRoutes()
      setRoutes(response.data)
    } catch (err) {
      setError('Error al cargar las rutas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleRouteClick = (route) => {
    setSelectedRoute(route)
    setShowRouteDetail(true)
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const groupedByMonth = {}
  routes.forEach(route => {
    const [year, month] = route.dia_ruta.split('-')
    const monthKey = `${monthNames[parseInt(month) - 1]} ${year}`

    if (!groupedByMonth[monthKey]) {
      groupedByMonth[monthKey] = []
    }
    groupedByMonth[monthKey].push(route)
  })

  // Ordenar meses y días
  const sortedMonths = Object.entries(groupedByMonth).sort((a, b) => {
    const [aMonth, aYear] = a[0].split(' ')
    const [bMonth, bYear] = b[0].split(' ')
    if (aYear !== bYear) return aYear.localeCompare(bYear)
    return monthNames.indexOf(aMonth) - monthNames.indexOf(bMonth)
  })

  return (
    <div className="dashboard">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container">
        <h1>🏍️ Rutas Disponibles</h1>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Cargando rutas...</div>
        ) : routes.length === 0 ? (
          <div className="no-routes">
            <p>No hay rutas publicadas en este momento</p>
            <button onClick={() => navigate('/calendario')}>Ver calendario</button>
          </div>
        ) : (
          <div className="routes-by-month">
            {sortedMonths.map(([monthKey, monthRoutes]) => (
              <div key={monthKey} className="month-section">
                <button
                  className="month-title-btn"
                  onClick={() => toggleMonth(monthKey)}
                >
                  {expandedMonths[monthKey] ? '▼' : '▶'} {monthKey}
                </button>

                {expandedMonths[monthKey] && (
                <div className="routes-by-day">
                  {Object.entries(
                    monthRoutes
                      .sort((a, b) => a.dia_ruta.localeCompare(b.dia_ruta))
                      .reduce((acc, route) => {
                        const day = route.dia_ruta.split('-')[2]
                        if (!acc[day]) {
                          acc[day] = []
                        }
                        acc[day].push(route)
                        return acc
                      }, {})
                  ).map(([day, dayRoutes]) => (
                    <div key={day} className="day-group">
                      <h3 className="day-title">📅 Día {day}</h3>
                      {dayRoutes.map(route => (
                        <div
                          key={route.id}
                          className="route-item"
                          onClick={() => handleRouteClick(route)}
                        >
                          <div className="route-name">{route.ruta.nombre}</div>
                          <div className="route-time">🕐 {route.hora_ruta}</div>
                          <div className="route-attendees">👥 {route.asistentes.length} participante{route.asistentes.length !== 1 ? 's' : ''}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showRouteDetail && selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          user={user}
          onClose={() => {
            setShowRouteDetail(false)
            setSelectedRoute(null)
          }}
          onRefresh={() => {
            loadRoutes()
          }}
        />
      )}
    </div>
  )
}
