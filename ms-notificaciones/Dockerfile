FROM node:22-alpine AS builder
WORKDIR /app

COPY ms-notificaciones/package*.json ./
RUN npm install

COPY ms-notificaciones/src ./src
COPY ms-notificaciones/tsconfig*.json ./
COPY ms-notificaciones/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

RUN npm run build

FROM node:22-alpine
WORKDIR /app

COPY ms-notificaciones/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

# Notificaciones normalmente solo usa REST, por lo que exponemos un puerto
EXPOSE 3006

CMD ["npm", "run", "start:prod"]