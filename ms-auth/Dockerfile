FROM node:20-alpine AS builder
WORKDIR /app

# Copiar dependencias usando la ruta del contexto
COPY ms-auth/package*.json ./
RUN npm install

# Copiar código fuente y configuración
COPY ms-auth/src ./src
COPY ms-auth/tsconfig*.json ./
COPY ms-auth/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

# Construir la aplicación
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Instalar solo dependencias de producción
COPY ms-auth/package*.json ./
RUN npm install --only=production

# Copiar el build compilado y los protos
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

# Exponer puertos REST y gRPC
EXPOSE 3001 5000

CMD ["npm", "run", "start:prod"]