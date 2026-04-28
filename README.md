# 🏍️ BCN Rockers - Motorcycle Routes Manager

Una aplicación web para gestionar y publicar rutas de motociclismo en grupo. Permite crear rutas, establecer puntos de encuentro y restaurantes, y compartir detalles con otros participantes.

## 🎯 Características

- 📅 Calendario interactivo para publicar rutas
- 🗺️ Integración con Google Maps
- 👥 Sistema de usuarios con roles (admin y regular)
- 🔐 Autenticación JWT
- 📱 Interfaz responsive
- 🍴 Gestión de puntos de encuentro y restaurantes
- 📤 Compartir rutas por WhatsApp

## 🛠️ Requisitos Previos

- Python 3.8+
- Node.js 16+
- npm o yarn
- SQLite3

## 📦 Instalación

### Backend (FastAPI)

```bash
# Navegar al directorio del backend
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# En Linux/Mac:
source venv/bin/activate
# En Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env
cp .env.example .env

# Ejecutar migraciones (si aplica)
# python -m alembic upgrade head

# Iniciar servidor de desarrollo
python -m uvicorn app.main:app --reload --port 8002
```

El servidor estará disponible en `http://localhost:8002`

### Frontend (React + Vite)

```bash
# Navegar al directorio del frontend
cd frontend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## 🔧 Configuración

### Variables de Entorno Backend (.env)

```
DATABASE_URL=sqlite:///./rutas_moto.db
SECRET_KEY=tu-clave-secreta-aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Variables de Entorno Frontend (.env)

```
VITE_API_URL=http://localhost:8002
```

## 🚀 Uso

1. **Registrarse**: Crea una cuenta en la aplicación
2. **Ver Calendario**: Accede al calendario para ver las rutas publicadas
3. **Crear Ruta**: Haz clic en un día para crear una nueva ruta
4. **Publicar**: Publica la ruta para que otros participantes puedan verla
5. **Compartir**: Usa el botón de compartir para enviar los detalles por WhatsApp

## 👤 Roles de Usuario

- **Admin**: Puede crear, editar y eliminar rutas, editar fecha/hora de rutas publicadas
- **Usuario Regular**: Puede crear rutas y publicarlas, editar todos los parámetros antes de publicar

## 📱 Estructura del Proyecto

```
bcnrockers_app/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── services/
│   ├── venv/
│   ├── requirements.txt
│   └── rutas_moto.db
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── contexts/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔐 Autenticación

La aplicación usa JWT (JSON Web Tokens) para autenticación. Los tokens se generan en el login y se incluyen en cada request.

## 🌐 Despliegue

Para usar la aplicación en una red externa:

1. Configura tu dominio dinámico (ej: DynV6)
2. Abre los puertos necesarios en tu router
3. Actualiza `VITE_API_URL` en el frontend con tu dominio
4. Asegúrate que el certificado SSL esté configurado (si es necesario)

## 📝 Licencia

Proyecto privado para BCN Rockers

## 👥 Desarrollado por

BCN Rockers Development Team
