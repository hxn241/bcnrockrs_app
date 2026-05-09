# ⚡ Inicio Rápido - BCN Rockers Routes

## 📋 Requisitos

- ✅ Python 3.10+
- ❌ Node.js 18+ (necesitas instalarlo)

## 🚀 Instalación Rápida (3 pasos)

### Paso 1: Instalar Node.js (sin sudo)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### Paso 2: Ejecutar script de setup

```bash
cd /home/hexen/Projects/bcnrockers_app
bash setup.sh
```

### Paso 3: Iniciar los servidores

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 🌐 Acceso

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8002
- **Documentación API**: http://localhost:8002/docs

## 🧪 Primer uso

1. Abre http://localhost:3000
2. Clic en "Regístrate aquí"
3. Crea una cuenta:
   - Usuario: `test`
   - Email: `test@example.com`
   - Contraseña: `password123`
4. Inicia sesión
5. ¡Listo! Verás el dashboard

## 📁 Estructura

```
bcnrockers_app/
├── backend/         ← API FastAPI (puerto 8002)
│   ├── app/
│   │   ├── main.py          (aplicación)
│   │   ├── models/          (base de datos)
│   │   ├── routes/          (endpoints)
│   │   └── schemas/         (validación)
│   ├── venv/                (entorno virtual)
│   └── requirements.txt
│
├── frontend/        ← React app (puerto 3000)
│   ├── src/
│   │   ├── components/      (botones, tarjetas, etc)
│   │   ├── pages/           (login, dashboard, calendar)
│   │   ├── services/        (cliente API)
│   │   └── styles/          (CSS)
│   ├── node_modules/        (dependencias npm)
│   └── package.json
│
├── rutas_moto.db    ← Base de datos SQLite
└── setup.sh         ← Script de instalación
```

## 🔧 Cambios principales vs Bot Telegram

| Feature | Telegram Bot | Web App |
|---------|-------------|---------|
| Autenticación | Solo admin | Registro y login |
| Gestión Rutas | Comandos | Dashboard visual |
| Calendario | No | Sí ✨ |
| Apuntarse | Reacciones | Botón |
| Persistencia | SQLite | SQLite + API |

## ⚙️ Configuración (.env)

### Backend (backend/.env)
```
POSTGRES_URL=sqlite:///./rutas_moto.db
SECRET_KEY=tu-clave-super-segura-cambiar-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
```

### Frontend (frontend/.env)
```
VITE_API_URL=http://localhost:8002
```

## 🆘 Troubleshooting

### "npm: command not found"
→ Instala Node.js con nvm (ver Paso 1)

### "ModuleNotFoundError" en Python
→ Activa el entorno virtual:
```bash
cd backend
source venv/bin/activate
```

### Puerto 8002/3000 ya en uso
→ Cambia el puerto:
```bash
# Backend en 8002 (por defecto)
python -m uvicorn app.main:app --reload --port 8002

# Frontend en 3001
npm run dev -- --port 3001
```

### Error de CORS
→ Verifica que `frontend/.env` tiene:
```
VITE_API_URL=http://localhost:8002
```

## 📚 Documentación Completa

Ver [README_NEW.md](README_NEW.md) para:
- API endpoints
- Base de datos
- Variables de entorno
- Build para producción
- Docker

## 🎯 Próximas Mejoras

- [ ] Panel admin para crear rutas
- [ ] Sistema de valoraciones
- [ ] Chat entre participantes
- [ ] Notificaciones
- [ ] Mapas interactivos
- [ ] Exportar rutas a GPX

## ❓ Preguntas

Consulta la documentación de la API en: **http://localhost:8002/docs**
