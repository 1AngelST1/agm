FROM node:18-alpine AS builder
WORKDIR /app

COPY ms-asistencias/package*.json ./
RUN npm install

COPY ms-asistencias/src ./src
COPY ms-asistencias/tsconfig*.json ./
COPY ms-asistencias/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

RUN npm run build

FROM node:18-alpine
WORKDIR /app

COPY ms-asistencias/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

EXPOSE 3005 5005

CMD ["npm", "run", "start:prod"]