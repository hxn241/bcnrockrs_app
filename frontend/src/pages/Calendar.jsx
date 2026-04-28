import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasPublicadasService } from '../services/api'
import Navigation from '../components/Navigation'
import PublishRouteModal from '../components/PublishRouteModal'
import RouteDetailModal from '../components/RouteDetailModal'
import '../styles/Dashboard.css'
import '../styles/Calendar.css'

export default function Calendar() {
  const { user, logout } = useAuth()
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalizar a las 00:00:00
  const [currentDate, setCurrentDate] = useState(new Date(today))
  const [routes, setRoutes] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [showRouteDetail, setShowRouteDetail] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadAllRoutes()
  }, [])

  const loadAllRoutes = async () => {
    try {
      setLoading(true)
      const response = await rutasPublicadasService.getPublishedRoutes()

      const grouped = {}
      response.data.forEach(route => {
        if (!grouped[route.dia_ruta]) {
          grouped[route.dia_ruta] = []
        }
        grouped[route.dia_ruta].push(route)
      })

      setRoutes(grouped)
    } catch (err) {
      setError('Error al cargar las rutas del calendario')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const previousMonth = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    
    // No permitir ir a meses anteriores a hoy
    if (previousDate.getFullYear() < today.getFullYear() || 
        (previousDate.getFullYear() === today.getFullYear() && previousDate.getMonth() < today.getMonth())) {
      return
    }
    
    setCurrentDate(previousDate)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleDayClick = (day) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const selectedDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    selectedDay.setHours(0, 0, 0, 0)
    
    // No permitir seleccionar fechas pasadas
    if (selectedDay < today) {
      setError('❌ No puedes publicar rutas en fechas pasadas')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setShowPublishModal(true)
  }

  const handleRouteClick = (route, e) => {
    e.stopPropagation()
    setSelectedRoute(route)
    setShowRouteDetail(true)
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)

  return (
    <div className="dashboard">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container">
        <header className="dashboard-heading">
          <h1 className="dashboard-heading-title">Calendario de rutas</h1>
          <div className="dashboard-heading-line" aria-hidden="true" />
          <p className="dashboard-heading-sub">Haz clic en un día para publicar o ver una salida</p>
        </header>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Cargando calendario...</div>
        ) : (
          <div className="calendar">
            <div className="calendar-header">
              <button 
                onClick={previousMonth}
                disabled={currentDate.getFullYear() === new Date().getFullYear() && currentDate.getMonth() === new Date().getMonth()}
              >
                ←
              </button>
              <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
              <button onClick={nextMonth}>→</button>
            </div>

            <div className="weekdays">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sab</div>
              <div>Dom</div>
            </div>

            <div className="days">
              {Array(firstDay).fill(null).map((_, i) => (
                <div key={`empty-${i}`} className="day empty"></div>
              ))}

              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayRoutes = routes[dateStr] || []
                
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const selectedDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                selectedDay.setHours(0, 0, 0, 0)
                const isPastDay = selectedDay < today
                const isToday = selectedDay.getTime() === today.getTime()

                return (
                  <div
                    key={day}
                    className={`day ${dayRoutes.length > 0 ? 'has-routes' : ''} ${isPastDay ? 'past-day' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => !isPastDay && handleDayClick(day)}
                    style={{ cursor: isPastDay ? 'not-allowed' : 'pointer' }}
                  >
                    <span className="day-number">{day}</span>
                    {dayRoutes.length > 0 && (
                      <div className="day-routes">
                        {dayRoutes.map((route, idx) => (
                          <div
                            key={route.id}
                            className="route-symbol"
                            onClick={(e) => handleRouteClick(route, e)}
                            title={`${route.ruta.nombre} - ${route.hora_ruta}`}
                          >
                            🏍️
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modal para crear/seleccionar ruta */}
        {showPublishModal && selectedDate && (
          <PublishRouteModal
            date={selectedDate}
            onClose={() => {
              setShowPublishModal(false)
              setSelectedDate(null)
            }}
            onPublish={() => {
              loadAllRoutes()
            }}
          />
        )}

        {/* Modal para ver detalles de ruta */}
        {showRouteDetail && selectedRoute && (
          <RouteDetailModal
            route={selectedRoute}
            user={user}
            onClose={() => {
              setShowRouteDetail(false)
              setSelectedRoute(null)
            }}
            onRefresh={() => {
              loadAllRoutes()
            }}
          />
        )}
      </div>
    </div>
  )
}
