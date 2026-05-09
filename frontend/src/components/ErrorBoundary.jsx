import React from 'react'

/** Captura errores de render en rutas y evita pantalla en blanco (solo degradado del body). */
export class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[KurveMaster]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-fallback">
          <p>Something went wrong loading the app.</p>
          <p className="app-error-hint">
            Try refreshing the page. If it persists, clear site data for this URL or update your browser.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
