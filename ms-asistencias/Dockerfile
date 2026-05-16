# Usamos una imagen ligera de Node.js
FROM node:18-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos todo el código fuente
COPY . .

# Compilamos la aplicación de NestJS
RUN npm run build

# Exponemos los puertos (REST y gRPC)
EXPOSE 3005 5005

# Comando para iniciar el microservicio
CMD ["npm", "run", "start:prod"]