#!/bin/bash

echo "🚀 BCN Rockers Routes - Setup Automático"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python
echo -e "${BLUE}1. Verificando Python...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓ $PYTHON_VERSION encontrado${NC}"
else
    echo -e "${YELLOW}✗ Python 3 no encontrado. Instálalo primero.${NC}"
    exit 1
fi

# Check Node.js
echo ""
echo -e "${BLUE}2. Verificando Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION encontrado${NC}"
    echo -e "${GREEN}✓ npm $NPM_VERSION encontrado${NC}"
else
    echo -e "${YELLOW}⚠ Node.js no está instalado.${NC}"
    echo -e "${YELLOW}Instálalo con: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash${NC}"
    echo -e "${YELLOW}Luego: nvm install 20 && nvm use 20${NC}"
    exit 1
fi

# Setup Backend
echo ""
echo -e "${BLUE}3. Configurando Backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "Creando entorno virtual..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "Instalando dependencias..."
pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Archivo .env creado (edítalo si necesitas cambiar valores)${NC}"
else
    echo -e "${GREEN}✓ .env ya existe${NC}"
fi

cd ..

# Setup Frontend
echo ""
echo -e "${BLUE}4. Configurando Frontend...${NC}"
cd frontend

echo "Instalando dependencias npm..."
npm install > /dev/null 2>&1

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Archivo .env creado${NC}"
else
    echo -e "${GREEN}✓ .env ya existe${NC}"
fi

cd ..

# Summary
echo ""
echo -e "${GREEN}=========================================="
echo "✓ ¡Setup completado!"
echo "==========================================${NC}"
echo ""
echo "📝 Próximos pasos:"
echo ""
echo "1. Terminal 1 - Backend:"
echo -e "   ${BLUE}cd backend${NC}"
echo -e "   ${BLUE}source venv/bin/activate${NC}"
echo -e "   ${BLUE}python -m uvicorn app.main:app --reload${NC}"
echo ""
echo "2. Terminal 2 - Frontend:"
echo -e "   ${BLUE}cd frontend${NC}"
echo -e "   ${BLUE}npm run dev${NC}"
echo ""
echo "3. Abre en tu navegador:"
echo -e "   ${BLUE}http://localhost:3000${NC}"
echo ""
echo "📚 Documentación API disponible en:"
echo -e "   ${BLUE}http://localhost:8000/docs${NC}"
echo ""
