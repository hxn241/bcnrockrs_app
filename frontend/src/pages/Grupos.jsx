import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Navigation from '../components/Navigation'
import { gruposService } from '../services/api'
import { resolveUploadUrl } from '../utils/apiBaseUrl'
import '../styles/Dashboard.css'
import '../styles/Grupos.css'

export default function Grupos() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [todos, setTodos] = useState([])
  const [miosIds, setMiosIds] = useState(new Set())
  const [pendientesIds, setPendientesIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [creating, setCreating] = useState(false)

  const [expandedId, setExpandedId] = useState(null)
  const [detalleById, setDetalleById] = useState({})
  const [loadingDetalleId, setLoadingDetalleId] = useState(null)
  const [actionBusyId, setActionBusyId] = useState(null)
  const [logoBusyId, setLogoBusyId] = useState(null)

  const load = async () => {
    setError('')
    try {
      setLoading(true)
      const [allRes, miosRes, pendRes] = await Promise.all([
        gruposService.listar(),
        gruposService.misGrupos(),
        gruposService.misSolicitudesPendientesIds()
      ])
      setTodos(allRes.data || [])
      setMiosIds(new Set((miosRes.data || []).map((g) => g.id)))
      setPendientesIds(new Set(pendRes.data || []))
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudieron cargar los grupos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const fetchDetalle = useCallback(async (grupoId) => {
    setLoadingDetalleId(grupoId)
    setError('')
    try {
      const res = await gruposService.detalle(grupoId)
      setDetalleById((prev) => ({ ...prev, [grupoId]: res.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cargar el detalle del grupo.')
    } finally {
      setLoadingDetalleId(null)
    }
  }, [])

  const toggleExpand = (g) => {
    if (expandedId === g.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(g.id)
    if (!detalleById[g.id]) {
      fetchDetalle(g.id)
    }
  }

  const refreshDetalleIfExpanded = async (grupoId) => {
    if (expandedId === grupoId) {
      await fetchDetalle(grupoId)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const crear = async (e) => {
    e.preventDefault()
    const n = nombreNuevo.trim()
    if (n.length < 2) {
      setError('El nombre del grupo debe tener al menos 2 caracteres.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await gruposService.crear({ nombre: n })
      setNombreNuevo('')
      await load()
      const newId = res.data?.id
      if (newId) {
        setExpandedId(newId)
        await fetchDetalle(newId)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo crear el grupo.')
    } finally {
      setCreating(false)
    }
  }

  const solicitar = async (grupoId) => {
    setActionBusyId(grupoId)
    setError('')
    try {
      await gruposService.solicitar(grupoId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo enviar la solicitud.')
    } finally {
      setActionBusyId(null)
    }
  }

  const cancelarSolicitud = async (grupoId) => {
    setActionBusyId(grupoId)
    setError('')
    try {
      await gruposService.cancelarSolicitud(grupoId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cancelar la solicitud.')
    } finally {
      setActionBusyId(null)
    }
  }

  const salir = async (grupoId) => {
    setActionBusyId(grupoId)
    setError('')
    try {
      await gruposService.salir(grupoId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo salir del grupo.')
    } finally {
      setActionBusyId(null)
    }
  }

  const aceptar = async (grupoId, userId) => {
    setActionBusyId(`${grupoId}-${userId}`)
    setError('')
    try {
      await gruposService.aceptarSolicitud(grupoId, userId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo aceptar la solicitud.')
    } finally {
      setActionBusyId(null)
    }
  }

  const rechazar = async (grupoId, userId) => {
    setActionBusyId(`${grupoId}-${userId}`)
    setError('')
    try {
      await gruposService.rechazarSolicitud(grupoId, userId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo rechazar la solicitud.')
    } finally {
      setActionBusyId(null)
    }
  }

  const subirLogo = async (grupoId, file) => {
    setLogoBusyId(grupoId)
    setError('')
    try {
      await gruposService.uploadLogo(grupoId, file)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo subir el logo.')
    } finally {
      setLogoBusyId(null)
    }
  }

  const quitarLogo = async (grupoId) => {
    setLogoBusyId(grupoId)
    setError('')
    try {
      await gruposService.deleteLogo(grupoId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo quitar el logo.')
    } finally {
      setLogoBusyId(null)
    }
  }

  const expulsarMiembro = async (grupoId, userId) => {
    setActionBusyId(`${grupoId}-expulsar-${userId}`)
    setError('')
    try {
      await gruposService.expulsarMiembro(grupoId, userId)
      await load()
      await refreshDetalleIfExpanded(grupoId)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo expulsar al miembro.')
    } finally {
      setActionBusyId(null)
    }
  }

  const eliminarGrupo = async (grupoId) => {
    setActionBusyId(`eliminar-${grupoId}`)
    setError('')
    try {
      await gruposService.eliminar(grupoId)
      setExpandedId((cur) => (cur === grupoId ? null : cur))
      setDetalleById((prev) => {
        const next = { ...prev }
        delete next[grupoId]
        return next
      })
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el grupo.')
    } finally {
      setActionBusyId(null)
    }
  }

  const onLogoFile = (grupoId, e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) subirLogo(grupoId, file)
  }

  return (
    <div className="dashboard grupos-page">
      <Navigation user={user} onLogout={handleLogout} />

      <div className="container">
        <header className="dashboard-heading">
          <h1 className="dashboard-heading-title">Grupos</h1>
          <div className="dashboard-heading-line" aria-hidden="true" />
          <p className="dashboard-heading-sub">
            Crea un grupo (entras como miembro al momento) o solicita unirte a uno: el creador del grupo debe
            aceptarte. El creador puede expulsar miembros y eliminar el grupo. Las salidas «solo mi grupo» las ven
            los miembros aceptados; si eliminas el grupo, esas salidas pasan a visibilidad abierta.
          </p>
        </header>

        {error && <div className="error-message">{error}</div>}

        <section className="grupos-crear-card">
          <h2 className="grupos-section-title">Crear grupo</h2>
          <form className="grupos-crear-form" onSubmit={crear}>
            <input
              type="text"
              className="grupos-input"
              placeholder="Nombre del grupo (ej. PEPE)"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              maxLength={80}
              disabled={creating}
            />
            <button type="submit" className="grupos-btn-primary" disabled={creating}>
              {creating ? 'Creando…' : 'Crear'}
            </button>
          </form>
        </section>

        <section className="grupos-lista-card">
          <h2 className="grupos-section-title">Grupos disponibles</h2>
          {loading ? (
            <div className="loading">Cargando…</div>
          ) : todos.length === 0 ? (
            <p className="grupos-empty">Aún no hay grupos. Crea el primero arriba.</p>
          ) : (
            <ul className="grupos-lista">
              {todos.map((g) => {
                const detalle = detalleById[g.id]
                const busy = actionBusyId === g.id
                const expanded = expandedId === g.id
                const loadingDet = loadingDetalleId === g.id
                const esMiembro = miosIds.has(g.id)
                const solicitudPendiente = pendientesIds.has(g.id)

                return (
                  <li key={g.id} className={`grupos-fila-wrap ${expanded ? 'grupos-fila-wrap-expanded' : ''}`}>
                    <div className="grupos-fila">
                      <div className="grupos-fila-main">
                        {g.logo_url ? (
                          <img
                            className="grupos-list-thumb"
                            src={resolveUploadUrl(g.logo_url)}
                            alt=""
                            width={40}
                            height={40}
                          />
                        ) : (
                          <div className="grupos-list-thumb grupos-list-thumb-placeholder" aria-hidden="true" />
                        )}
                        <span className="grupos-nombre">{g.nombre}</span>
                        <span className="grupos-meta">
                          {g.num_miembros ?? 0}{' '}
                          {g.num_miembros === 1 ? 'miembro' : 'miembros'}
                        </span>
                        {esMiembro && <span className="grupos-pill-miembro">Miembro</span>}
                        {solicitudPendiente && !esMiembro && (
                          <span className="grupos-pill-pendiente">Solicitud enviada</span>
                        )}
                      </div>
                      <div className="grupos-fila-actions">
                        {esMiembro && (
                          <button
                            type="button"
                            className="grupos-btn-salir"
                            disabled={busy}
                            onClick={() => salir(g.id)}
                          >
                            Salir
                          </button>
                        )}
                        <button
                          type="button"
                          className="grupos-btn-ver"
                          onClick={() => toggleExpand(g)}
                          aria-expanded={expanded}
                        >
                          {expanded ? 'Ocultar' : 'Ver grupo'}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="grupos-panel-detalle">
                        {loadingDet && <p className="grupos-detalle-loading">Cargando…</p>}
                        {!loadingDet && detalle && (
                          <>
                            <div className="grupos-detalle-header-row">
                              {detalle.logo_url ? (
                                <img
                                  className="grupos-detalle-logo"
                                  src={resolveUploadUrl(detalle.logo_url)}
                                  alt=""
                                  width={72}
                                  height={72}
                                />
                              ) : (
                                <div className="grupos-detalle-logo grupos-detalle-logo-placeholder" aria-hidden="true" />
                              )}
                              <div className="grupos-detalle-header-text">
                                <h3 className="grupos-detalle-titulo">{detalle.nombre}</h3>
                                <p className="grupos-detalle-sub">
                                  {detalle.num_miembros}{' '}
                                  {detalle.num_miembros === 1 ? 'persona en el grupo' : 'personas en el grupo'}
                                  {detalle.eres_creador && ' · Eres el creador'}
                                </p>
                                {detalle.eres_creador && (
                                  <div className="grupos-creador-zona-peligro">
                                    <button
                                      type="button"
                                      className="grupos-btn-eliminar-grupo"
                                      disabled={actionBusyId === `eliminar-${g.id}`}
                                      onClick={() => {
                                        if (
                                          !window.confirm(
                                            '¿Eliminar este grupo para siempre? Se quitarán solicitudes y membresías. Las salidas publicadas solo para este grupo pasarán a visibilidad abierta.'
                                          )
                                        ) {
                                          return
                                        }
                                        eliminarGrupo(g.id)
                                      }}
                                    >
                                      {actionBusyId === `eliminar-${g.id}` ? 'Eliminando…' : 'Eliminar grupo'}
                                    </button>
                                  </div>
                                )}
                                {detalle.eres_creador && (
                                  <div className="grupos-logo-acciones">
                                    <label className="grupos-logo-upload-label">
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        className="grupos-file-input-hidden"
                                        disabled={logoBusyId === g.id}
                                        onChange={(ev) => onLogoFile(g.id, ev)}
                                      />
                                      {logoBusyId === g.id ? 'Subiendo…' : 'Cambiar logo'}
                                    </label>
                                    {detalle.logo_url && (
                                      <button
                                        type="button"
                                        className="grupos-btn-quitar-logo"
                                        disabled={logoBusyId === g.id}
                                        onClick={() => quitarLogo(g.id)}
                                      >
                                        Quitar logo
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {detalle.eres_miembro || detalle.eres_creador ? (
                              <div className="grupos-miembros-block">
                                <h4 className="grupos-subtitle">Miembros</h4>
                                {detalle.miembros.length === 0 ? (
                                  <p className="grupos-muted">Sin miembros listados.</p>
                                ) : (
                                  <ul className="grupos-miembros-lista">
                                    {detalle.miembros.map((m) => (
                                      <li key={m.user_id} className="grupos-miembro-fila">
                                        <span className="grupos-miembro-nombre-wrap">
                                          <span className="grupos-miembro-nombre">{m.username}</span>
                                          {m.user_id === detalle.creador_id && (
                                            <span className="grupos-badge-creador">creador</span>
                                          )}
                                        </span>
                                        {detalle.eres_creador && m.user_id !== detalle.creador_id && (
                                          <button
                                            type="button"
                                            className="grupos-btn-expulsar"
                                            disabled={actionBusyId === `${g.id}-expulsar-${m.user_id}`}
                                            onClick={() => {
                                              if (
                                                !window.confirm(
                                                  `¿Expulsar a ${m.username} del grupo?`
                                                )
                                              ) {
                                                return
                                              }
                                              expulsarMiembro(g.id, m.user_id)
                                            }}
                                          >
                                            Expulsar
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ) : (
                              <p className="grupos-muted">
                                Cuando te acepten verás aquí la lista de miembros.
                              </p>
                            )}

                            {detalle.eres_creador && detalle.solicitudes_pendientes?.length > 0 && (
                              <div className="grupos-solicitudes-block">
                                <h4 className="grupos-subtitle">Solicitudes pendientes</h4>
                                <ul className="grupos-solicitudes-lista">
                                  {detalle.solicitudes_pendientes.map((s) => (
                                    <li key={s.user_id} className="grupos-solicitud-fila">
                                      <span>{s.username}</span>
                                      <span className="grupos-solicitud-actions">
                                        <button
                                          type="button"
                                          className="grupos-btn-aceptar"
                                          disabled={actionBusyId === `${g.id}-${s.user_id}`}
                                          onClick={() => aceptar(g.id, s.user_id)}
                                        >
                                          Aceptar
                                        </button>
                                        <button
                                          type="button"
                                          className="grupos-btn-rechazar"
                                          disabled={actionBusyId === `${g.id}-${s.user_id}`}
                                          onClick={() => rechazar(g.id, s.user_id)}
                                        >
                                          Rechazar
                                        </button>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="grupos-panel-acciones-extra">
                              {!detalle.eres_miembro && detalle.solicitud_pendiente_tuya && (
                                <button
                                  type="button"
                                  className="grupos-btn-cancelar-sol grupos-btn-solicitar-full"
                                  disabled={busy}
                                  onClick={() => cancelarSolicitud(g.id)}
                                >
                                  Retirar solicitud de ingreso
                                </button>
                              )}
                              {!detalle.eres_miembro && !detalle.solicitud_pendiente_tuya && (
                                <button
                                  type="button"
                                  className="grupos-btn-solicitar grupos-btn-solicitar-full"
                                  disabled={busy}
                                  onClick={() => solicitar(g.id)}
                                >
                                  Solicitar unirme a este grupo
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
