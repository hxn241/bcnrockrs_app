# Contexto de build: raíz del monorepo (ver docker-compose.yml)
FROM node:20-alpine

WORKDIR /app

# Copiar manifiestos del monorepo y del workspace shared
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/

# Copiar manifiestos del frontend
COPY frontend/package*.json ./frontend/

# Instalar todas las dependencias del monorepo (resuelve @bcnrockrs/shared como workspace)
RUN npm install

# Copiar el código fuente
COPY packages/shared/ ./packages/shared/
COPY frontend/ ./frontend/

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "run", "dev"]
