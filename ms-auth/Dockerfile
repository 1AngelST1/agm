# Stage 1: Build (compilar TypeScript a JavaScript)
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json del microservicio
COPY ms-auth/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente del microservicio
COPY ms-auth/src ./src
COPY ms-auth/tsconfig*.json ./

# Copiar carpeta proto (necesaria para gRPC) - estará en /app/proto
COPY proto /app/proto

# Compilar TypeScript a JavaScript
RUN npm run build

# Stage 2: Runtime (ejecutar la aplicación)
FROM node:20-alpine

WORKDIR /app

# Copiar package.json para instalar solo dependencias de producción
COPY ms-auth/package*.json ./

# Instalar SOLO dependencias de producción (más rápido y más ligero)
RUN npm ci --only=production

# Copiar código compilado del stage anterior
COPY --from=builder /app/dist ./dist

# Copiar carpeta proto desde builder (se necesita para gRPC en runtime)
COPY --from=builder /app/proto /app/proto

# Verificar que proto files existen
RUN ls -la /app/proto/

# Exponer puertos
EXPOSE 3001 5000

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]
