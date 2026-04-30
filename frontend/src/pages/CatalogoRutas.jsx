import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasService } from '../services/api'
import Navigation from '../components/Navigation'
import EditRouteModal from '../components/EditRouteModal'
import '../styles/Dashboard.css'
import '../styles/CatalogoRutas.css'

function formatApiError(err) {
  const d = err.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0]
    if (typeof first === 'string') return first
    if (first?.msg) return first.msg
  }
  if (err.response?.status === 403) return 'No tienes permiso (solo administradores).'
  if (err.response?.status === 401) return 'Sesión caducada: vuelve a iniciar sesión.'
  return 'No se pudo eliminar la ruta.'
}

export default function CatalogoRutas() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [editingRuta, setEditingRuta] = useState(null)

  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (user?.is_admin) {
      loadRutas()
    }
  }, [user, navigate])

  const loadRutas = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await rutasService.getAllRoutes()
      setRutas(response.data)
    } catch (err) {
      setError('Error al cargar el catálogo de rutas')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (ruta) => {
    if (!globalThis.confirm(`¿Eliminar del catálogo la ruta «${ruta.nombre}»? Solo es posible si no tiene salidas publicadas en el calendario. Esta acción no se puede deshacer.`)) {
      return
    }
    setDeletingId(ruta.id)
    setError('')
    try {
      await rutasService.deleteRoute(ruta.id)
      setRutas((prev) => prev.filter((r) => r.id !== ruta.id))
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setDeletingId(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user?.is_admin) {
    return null
  }

  return (
    <div className="dashboard">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container">
        <header className="dashboard-heading">
          <h1 className="dashboard-heading-title">Catálogo de rutas</h1>
          <div className="dashboard-heading-line" aria-hidden="true" />
          <p className="dashboard-heading-sub">Rutas en base de datos — solo administradores</p>
        </header>
        <p className="catalogo-rutas-sub">
          Rutas guardadas en la base de datos. Solo los administradores ven esta pestaña.           Puedes
          editar el nombre de la ruta y todos los enlaces (recorrido Maps, encuentro, restaurante)
          con «Editar». No se puede
          eliminar una ruta si aún tiene salidas activas en el calendario: hay que despublicarlas o
          borrarlas antes.
        </p>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Cargando…</div>
        ) : rutas.length === 0 ? (
          <p className="catalogo-rutas-empty">No hay rutas en la base de datos.</p>
        ) : (
          <div className="catalogo-rutas-table-wrap">
            <table className="catalogo-rutas-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Enlace ruta</th>
                  <th className="catalogo-rutas-col-action">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td className="catalogo-rutas-nombre">{r.nombre}</td>
                    <td>
                      <a
                        href={r.link_ruta}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="catalogo-rutas-link-preview"
                      >
                        Abrir
                      </a>
                    </td>
                    <td className="catalogo-rutas-actions-cell">
                      <button
                        type="button"
                        className="btn catalogo-rutas-btn-edit"
                        onClick={() => setEditingRuta(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn catalogo-rutas-btn-delete"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                      >
                        {deletingId === r.id ? '…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRuta && (
        <EditRouteModal
          ruta={editingRuta}
          mode="edit"
          onClose={() => setEditingRuta(null)}
          onSave={loadRutas}
        />
      )}
    </div>
  )
}
