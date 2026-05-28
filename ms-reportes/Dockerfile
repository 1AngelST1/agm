FROM node:20-alpine AS builder
WORKDIR /app

COPY ms-reportes/package*.json ./
RUN npm install

COPY ms-reportes/src ./src
COPY ms-reportes/tsconfig*.json ./
COPY ms-reportes/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY ms-reportes/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

EXPOSE 3007 5007

CMD ["npm", "run", "start:prod"]