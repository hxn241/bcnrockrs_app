#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

backend_cmd="cd $(printf '%q' "$BACKEND") && source venv/bin/activate && python -m uvicorn app.main:app --reload --port 8002 --host 0.0.0.0"
frontend_cmd="cd $(printf '%q' "$FRONTEND") && npm run dev"

# Lanza el proceso desacoplado: muchos emuladores bloquean hasta cerrar la ventana si no van en background.
detach() {
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" &
  else
    "$@" &
  fi
  disown 2>/dev/null || true
}

open_terminal() {
  local title=$1
  local cmd=$2
  local inner="$cmd; exec bash -l"
  if command -v gnome-terminal >/dev/null 2>&1; then
    detach gnome-terminal --title="$title" -- bash -c "$inner"
    return 0
  fi
  if command -v konsole >/dev/null 2>&1; then
    detach konsole --title "$title" -e bash -c "$inner"
    return 0
  fi
  if command -v xfce4-terminal >/dev/null 2>&1; then
    detach xfce4-terminal --title="$title" -e "bash -lc $(printf '%q' "$inner")"
    return 0
  fi
  if command -v alacritty >/dev/null 2>&1; then
    detach alacritty --title "$title" -e bash -c "$inner"
    return 0
  fi
  if command -v xterm >/dev/null 2>&1; then
    detach xterm -title "$title" -e bash -c "$inner"
    return 0
  fi
  return 1
}

if [[ ! -d "$BACKEND/venv" ]]; then
  echo "No existe $BACKEND/venv. Crea el venv e instala dependencias antes." >&2
  exit 1
fi

if ! open_terminal "bcnrockrs-backend" "$backend_cmd"; then
  echo "No se encontró un emulador de terminal compatible (gnome-terminal, konsole, xfce4-terminal, alacritty, xterm)." >&2
  exit 1
fi

if ! open_terminal "bcnrockrs-frontend" "$frontend_cmd"; then
  echo "No se pudo abrir la segunda terminal." >&2
  exit 1
fi

echo "Backend y frontend lanzados en dos ventanas a la vez."
