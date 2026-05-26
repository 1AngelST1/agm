FROM node:20-alpine AS builder
WORKDIR /app

COPY ms-alumnos/package*.json ./
RUN npm install

COPY ms-alumnos/src ./src
COPY ms-alumnos/tsconfig*.json ./
COPY ms-alumnos/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY ms-alumnos/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

EXPOSE 3002 5002

CMD ["npm", "run", "start:prod"]