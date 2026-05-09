import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rutasService } from '../services/api'
import Navigation from '../components/Navigation'
import EditRouteModal from '../components/EditRouteModal'
import { nombreComunidad, nombreProvincia } from '../constants/espanaUbicacion'
import '../styles/Dashboard.css'
import '../styles/CatalogoRutas.css'
import { formatApiErrorMessage } from '../utils/apiErrorMessage'

function esAdmin(user) {
  return user?.is_admin === true || user?.is_admin === 1
}

function esCreadorCatalogo(user, ruta) {
  return ruta.creador_id != null && Number(user?.id) === Number(ruta.creador_id)
}

export default function CatalogoRutas() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [marcaBusyId, setMarcaBusyId] = useState(null)
  const [editingRuta, setEditingRuta] = useState(null)

  useEffect(() => {
    if (!user) return
    loadRutas()
  }, [user])

  const loadRutas = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await rutasService.getAllRoutes()
      setRutas(response.data)
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Error al cargar el catálogo de rutas.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (ruta) => {
    if (
      !globalThis.confirm(
        `¿Eliminar del catálogo la ruta «${ruta.nombre}»? Solo es posible si no tiene salidas publicadas activas. Esta acción no se puede deshacer.`
      )
    ) {
      return
    }
    setDeletingId(ruta.id)
    setError('')
    try {
      await rutasService.deleteRoute(ruta.id)
      setRutas((prev) => prev.filter((r) => r.id !== ruta.id))
    } catch (err) {
      setError(formatApiErrorMessage(err, 'No se pudo eliminar la ruta.'))
    } finally {
      setDeletingId(null)
    }
  }

  const toggleMarcaEliminacion = async (ruta) => {
    setMarcaBusyId(ruta.id)
    setError('')
    try {
      if (ruta.marcada_eliminacion) {
        await rutasService.desmarcarEliminacionCatalogo(ruta.id)
      } else {
        await rutasService.marcarEliminacionCatalogo(ruta.id)
      }
      await loadRutas()
    } catch (err) {
      setError(formatApiErrorMessage(err, 'No se pudo actualizar la marca.'))
    } finally {
      setMarcaBusyId(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) {
    return null
  }

  return (
    <div className="dashboard">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container">
        <header className="dashboard-heading">
          <h1 className="dashboard-heading-title">Catálogo de rutas</h1>
          <div className="dashboard-heading-line" aria-hidden="true" />
          <p className="dashboard-heading-sub">
            Plantillas que ves al publicar. Los administradores pueden editar y eliminar cualquier entrada. El resto de
            usuarios solo pueden marcar o desmarcar para eliminar las plantillas que ellos mismos crearon.
          </p>
        </header>

        {loading ? (
          <div className="loading">Cargando…</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : rutas.length === 0 ? (
          <p className="catalogo-rutas-empty">No hay rutas en el catálogo.</p>
        ) : (
          <div className="catalogo-rutas-table-wrap">
            <table className="catalogo-rutas-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>CCAA / provincia</th>
                  <th>Enlace ruta</th>
                  <th>Estado</th>
                  <th className="catalogo-rutas-col-action">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((r) => (
                  <tr
                    key={r.id}
                    className={r.marcada_eliminacion ? 'catalogo-rutas-row-pendiente' : undefined}
                  >
                    <td>{r.id}</td>
                    <td className="catalogo-rutas-nombre">{r.nombre}</td>
                    <td>
                      {r.ubicacion_region || r.ubicacion_ciudad
                        ? `${nombreComunidad(r.ubicacion_region) || r.ubicacion_region || '—'} · ${nombreProvincia(r.ubicacion_ciudad) || r.ubicacion_ciudad || '—'}`
                        : '—'}
                    </td>
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
                    <td>
                      {r.marcada_eliminacion ? (
                        <span className="catalogo-rutas-badge-pendiente">Pendiente de eliminar (admin)</span>
                      ) : (
                        <span className="catalogo-rutas-badge-ok">—</span>
                      )}
                    </td>
                    <td className="catalogo-rutas-actions-cell">
                      {esAdmin(user) && (
                        <button
                          type="button"
                          className="btn catalogo-rutas-btn-edit"
                          onClick={() => setEditingRuta(r)}
                        >
                          Editar
                        </button>
                      )}
                      {!esAdmin(user) && esCreadorCatalogo(user, r) && (
                        <button
                          type="button"
                          className={
                            r.marcada_eliminacion
                              ? 'btn catalogo-rutas-btn-desmarcar'
                              : 'btn catalogo-rutas-btn-marcar'
                          }
                          onClick={() => toggleMarcaEliminacion(r)}
                          disabled={marcaBusyId === r.id}
                        >
                          {marcaBusyId === r.id
                            ? '…'
                            : r.marcada_eliminacion
                              ? 'Desmarcar eliminación'
                              : 'Marcar para eliminar'}
                        </button>
                      )}
                      {esAdmin(user) && r.marcada_eliminacion && (
                        <button
                          type="button"
                          className="btn catalogo-rutas-btn-desmarcar"
                          onClick={() => toggleMarcaEliminacion(r)}
                          disabled={marcaBusyId === r.id}
                        >
                          {marcaBusyId === r.id ? '…' : 'Quitar marca'}
                        </button>
                      )}
                      {esAdmin(user) && (
                        <button
                          type="button"
                          className="btn catalogo-rutas-btn-delete"
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                        >
                          {deletingId === r.id ? '…' : 'Eliminar'}
                        </button>
                      )}
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
