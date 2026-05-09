#!/usr/bin/env bash
# Migra rutas_moto.db (SQLite) → PostgreSQL (p. ej. Render).
#
# URL de destino: backend/.env → POSTGRES_URL (preferido) o DATABASE_URL (p. ej. Render), igual que Settings.
#
# Uso:
#   ./migrate-to-postgres.sh
#
# Sin fichero / override:
#   POSTGRES_URL='postgresql://...' ./migrate-to-postgres.sh
#   ./migrate-to-postgres.sh --postgres 'postgresql://...'
#
# Opciones:
#   --sqlite URL     Por defecto sqlite:///./rutas_moto.db
#   --postgres URL   Tiene prioridad sobre POSTGRES_URL en .env
#   --install-deps   pip install -r requirements.txt antes de migrar
#   -h / --help

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

_POSTGRES_FROM_ENV="${POSTGRES_URL:-}"
POSTGRES_URL=""
CLI_POSTGRES=""
SQLITE_URL="${SQLITE_URL:-sqlite:///./rutas_moto.db}"
INSTALL_DEPS=0

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sqlite)
      SQLITE_URL="$2"
      shift 2
      ;;
    --postgres)
      CLI_POSTGRES="$2"
      shift 2
      ;;
    --install-deps)
      INSTALL_DEPS=1
      shift
      ;;
    -h | --help)
      usage 0
      ;;
    *)
      echo "Opción desconocida: $1"
      usage 1
      ;;
  esac
done

if [[ -f .env ]]; then
  echo "→ Cargando variables desde: $BACKEND_DIR/.env"
  unset POSTGRES_URL 2>/dev/null || true
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  if [[ -z "${POSTGRES_URL:-}" && -n "${DATABASE_URL:-}" ]]; then
    POSTGRES_URL="$DATABASE_URL"
  fi
fi

if [[ -n "$CLI_POSTGRES" ]]; then
  POSTGRES_URL="$CLI_POSTGRES"
elif [[ -z "${POSTGRES_URL:-}" ]]; then
  POSTGRES_URL="$_POSTGRES_FROM_ENV"
fi

if [[ -z "$POSTGRES_URL" ]]; then
  echo "Error: falta URL de base de datos."
  echo "  En backend/.env define POSTGRES_URL (preferido) o DATABASE_URL (p. ej. Render),"
  echo "  o exporta POSTGRES_URL / usa --postgres 'postgresql://…'"
  exit 1
fi

if [[ ! -f rutas_moto.db ]] && [[ "$SQLITE_URL" == sqlite:///./rutas_moto.db ]]; then
  echo "No encuentro rutas_moto.db en $BACKEND_DIR"
  echo "Copia aquí tu SQLite o usa: --sqlite sqlite:////ruta/absoluta/archivo.db"
  exit 1
fi

if [[ -f venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 no está instalado o no está en PATH."
  exit 1
fi

if [[ "$INSTALL_DEPS" -eq 1 ]] || ! python3 -c "import sqlalchemy" 2>/dev/null; then
  echo "Instalando dependencias (requirements.txt)..."
  pip install -r requirements.txt
fi

echo ""
echo "⚠  Esto VACÍA por completo el PostgreSQL de destino y copia los datos desde SQLite."
echo "   Origen SQLite: $SQLITE_URL"
echo "   Destino Postgres: POSTGRES_URL desde .env / argumentos (no se muestra aquí)."
echo ""
read -r -p 'Escribe SI en mayúsculas para continuar: ' confirm
if [[ "$confirm" != "SI" ]]; then
  echo "Cancelado."
  exit 1
fi

python3 migrate_sqlite_to_postgres.py \
  --sqlite "$SQLITE_URL" \
  --postgres "$POSTGRES_URL" \
  --confirm-wipe

echo ""
echo "Listo. Si tenías fotos o logos, copia la carpeta uploads/ al backend en Render."
echo "Comprueba en Render que POSTGRES_URL o DATABASE_URL del Web Service apunta a esta misma base."
