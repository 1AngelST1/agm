FROM node:20-alpine AS builder
WORKDIR /app

COPY ms-periodos/package*.json ./
RUN npm install

COPY ms-periodos/src ./src
COPY ms-periodos/tsconfig*.json ./
COPY ms-periodos/nest-cli.json ./
COPY proto /app/proto
COPY shared ./src/shared

RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY ms-periodos/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto /app/proto

EXPOSE 3004 5004

CMD ["npm", "run", "start:prod"]