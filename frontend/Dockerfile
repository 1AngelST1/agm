# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src ./src
COPY public ./public
COPY *.json ./

RUN npm run build

# Serve stage
FROM node:22-alpine

WORKDIR /app

RUN npm install -g http-server

COPY --from=builder /app/dist /app/dist

EXPOSE 4200

CMD ["http-server", "dist", "-p", "4200", "--cors"]
