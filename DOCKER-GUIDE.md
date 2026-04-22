# 🐳 Guía de Dockerización - AGM Backend

## ¿Qué se creó?

```
agm-backend/
├── docker-compose.yml          ← ACTUALIZADO con ms-auth y ms-alumnos
├── ms-auth/
│   ├── Dockerfile              ← ✅ NUEVO
│   ├── .dockerignore           ← ✅ NUEVO
│   ├── .env.example            ← ✅ NUEVO
│   └── src/
├── ms-alumnos/
│   ├── Dockerfile              ← ✅ NUEVO
│   ├── .dockerignore           ← ✅ NUEVO
│   ├── .env.example            ← ✅ NUEVO
│   └── src/
```

## 🚀 Cómo ejecutar TODO con un comando

### OPCIÓN 1: Construir y ejecutar (RECOMENDADO PRIMERO)

```bash
# Desde la raíz del proyecto (agm-backend/)
docker-compose up --build
```

**Qué hace:**
- Construye imágenes Docker de ms-auth y ms-alumnos
- Levanta PostgreSQL, MongoDB, Redis
- Inicia los 2 microservicios
- Todo conectado en una red interna

**Resultado:**
```
✅ PostgreSQL en puerto 5432
✅ MongoDB en puerto 27017
✅ Redis en puerto 6379
✅ ms-auth REST en http://localhost:3001
✅ ms-auth gRPC en localhost:5000
✅ ms-alumnos REST en http://localhost:3002
✅ ms-alumnos gRPC en localhost:5001
```

### OPCIÓN 2: Si ya hay imágenes construidas

```bash
docker-compose up
```

### OPCIÓN 3: Ejecutar en background

```bash
docker-compose up -d
```

## ❌ Para detener todo

```bash
docker-compose down
```

Si quieres eliminar volúmenes de BD:
```bash
docker-compose down -v
```

## 📝 ¿Qué contiene cada Dockerfile?

### Stage 1 (Build):
1. Comienza con Node 20 Alpine (ligero)
2. Instala TODAS las dependencias (dev + prod)
3. Compila TypeScript → JavaScript
4. Crea carpeta `/app/dist`

### Stage 2 (Runtime):
1. Comienza nuevo con Node 20 Alpine
2. Copia SOLO dependencias de producción
3. Copia código compilado del Stage 1
4. Expone puertos (3001/5000 para auth, 3002/5001 para alumnos)
5. Ejecuta `npm run start:prod`

**Ventaja:** Las imágenes son pequeñas (sin archivos innecesarios)

## 🔗 ¿Cómo se comunican los servicios?

**En docker-compose:**
- `ms-auth` está disponible en `http://ms-auth:3001` (REST)
- `ms-auth` está disponible en `ms-auth:5000` (gRPC)
- `ms-alumnos` puede llamar a ms-auth porque están en la misma red

**En tu código (ms-alumnos/app.module.ts):**
```typescript
// En desarrollo local (npm start:dev):
url: 'localhost:5000'

// En Docker (dentro del contenedor):
url: 'ms-auth:5000'  ← El nombre del servicio en docker-compose
```

## ⚠️ IMPORTANTE: Actualizar conexión a ms-auth

En `ms-alumnos/src/app.module.ts`, necesitas cambiar:

```typescript
// ACTUAL:
url: 'localhost:5000'  ← Solo funciona en local

// DEBE SER:
url: process.env.AUTH_GRPC_HOST + ':' + process.env.AUTH_GRPC_PORT
// O en desarrollo:
url: process.env.NODE_ENV === 'production' 
  ? 'ms-auth:5000'
  : 'localhost:5000'
```

## 🛠️ Comandos útiles

Ver logs de un servicio:
```bash
docker-compose logs ms-auth
docker-compose logs ms-alumnos
```

Entrar a un contenedor:
```bash
docker-compose exec ms-auth sh
docker-compose exec ms-alumnos sh
```

Reconstruir solo un servicio:
```bash
docker-compose up --build ms-auth
```

## 📌 Próximos pasos

1. Verifica que `.env` exista en cada microservicio (copia de `.env.example`)
2. Actualiza la conexión de gRPC en ms-alumnos
3. Ejecuta `docker-compose up --build`
4. Prueba los endpoints:

```bash
# Prueba ms-auth
curl http://localhost:3001/auth/me

# Prueba ms-alumnos
curl http://localhost:3002/alumnos/202253882
```

## 🎯 Ventajas de usar Docker

✅ Cada microservicio en su propio contenedor
✅ Fácil de compartir código (solo `docker-compose up`)
✅ Simula producción (mismo ambiente)
✅ Escalable (puedes añadir más microservicios fácil)
✅ Preparado para desplegar en cloud (Railway, Render, etc.)
