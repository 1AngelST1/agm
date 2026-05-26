FROM node:20-alpine AS builder
WORKDIR /app

COPY ms-calificaciones/package*.json ./
RUN npm install

COPY ms-calificaciones/src ./src
COPY ms-calificaciones/tsconfig*.json ./
COPY ms-calificaciones/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY ms-calificaciones/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

EXPOSE 3003 5003

CMD ["npm", "run", "start:prod"]