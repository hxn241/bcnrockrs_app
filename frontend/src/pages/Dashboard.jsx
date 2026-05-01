import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasPublicadasService } from '../services/api'
import RouteDetailModal from '../components/RouteDetailModal'
import Navigation from '../components/Navigation'
import { formatUbicacionSalida } from '../constants/paisesSalida'
import {
  COMUNIDADES_AUTONOMAS,
  provinciasPorComunidad,
  tieneZonaSalida
} from '../constants/espanaUbicacion'
import '../styles/Dashboard.css'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroCcaa, setFiltroCcaa] = useState('')
  const [filtroProvincia, setFiltroProvincia] = useState('')
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

  const provinciasFiltro = useMemo(() => provinciasPorComunidad(filtroCcaa), [filtroCcaa])

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const f = {}
      if (filtroCcaa.trim()) f.ccaa = filtroCcaa.trim().toUpperCase()
      if (filtroProvincia.trim()) f.provincia = filtroProvincia.trim().padStart(2, '0').slice(0, 2)
      const response = await rutasPublicadasService.getPublishedRoutes(f)
      setRoutes(response.data)
    } catch (err) {
      setError('Error al cargar las rutas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filtroCcaa, filtroProvincia])

  useEffect(() => {
    loadRoutes()
  }, [loadRoutes])

  const limpiarFiltros = () => {
    setFiltroCcaa('')
    setFiltroProvincia('')
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
        <header className="dashboard-heading">
          <h1 className="dashboard-heading-title">Rutas disponibles</h1>
          <div className="dashboard-heading-line" aria-hidden="true" />
          <p className="dashboard-heading-sub">
            Próximas salidas. La zona coincide con la comunidad y provincia de la plantilla al crearla; el listado se actualiza al cambiar los filtros.
          </p>
        </header>

        <section className="dashboard-filtros-zona" aria-label="Filtrar rutas por zona en España">
          <h2 className="dashboard-filtros-zona-title">Buscar por zona (comunidad y provincia)</h2>
          <div className="dashboard-filtros-zona-grid">
            <div>
              <label htmlFor="dash-filtro-ccaa">Comunidad autónoma</label>
              <select
                id="dash-filtro-ccaa"
                value={filtroCcaa}
                onChange={(e) => {
                  setFiltroCcaa(e.target.value)
                  setFiltroProvincia('')
                }}
              >
                <option value="">Todas</option>
                {COMUNIDADES_AUTONOMAS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dash-filtro-provincia">Provincia</label>
              <select
                id="dash-filtro-provincia"
                value={filtroProvincia}
                onChange={(e) => setFiltroProvincia(e.target.value)}
                disabled={!filtroCcaa}
              >
                <option value="">Todas (de la CCAA)</option>
                {provinciasFiltro.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="dashboard-filtros-zona-actions">
            <button type="button" className="dashboard-filtros-limpiar" onClick={limpiarFiltros}>
              Ver todas las zonas
            </button>
          </div>
        </section>

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
                          {tieneZonaSalida(route) && (
                            <div className="route-ubicacion-line">🌍 {formatUbicacionSalida(route)}</div>
                          )}
                          <div
                            className={`route-salida-visibilidad ${route.visibilidad === 'grupo' ? 'grupo' : 'abierta'}`}
                          >
                            {route.visibilidad === 'grupo'
                              ? `Grupo: ${route.grupo?.nombre || '…'}`
                              : 'Salida abierta'}
                          </div>
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
