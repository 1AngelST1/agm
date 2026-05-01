# ✅ Sistema de Autenticación - Guía Completa

## 📁 Estructura del Proyecto

```
ms-auth/
├── src/
│   ├── main.ts                 # Punto de entrada (HTTP + gRPC)
│   ├── app.module.ts           # Módulo principal
│   ├── app.controller.ts       # Controlador con lógica de autenticación
│   ├── app.service.ts          # Servicios auxiliares
│   ├── user.entity.ts          # Entidad User (Base de datos)
│   ├── guards/
│   │   └── admin.guard.ts      # Guard para proteger operaciones
│   └── dtos/
│       └── crear-usuario.dto.ts # DTOs para tipado
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 🔐 Sistema de Administrador Único

### Características:
✅ Solo existe **1 administrador** en el sistema
✅ El primer admin se crea sin autenticación
✅ Otros admins solo pueden ser creados por un admin autenticado
✅ Alumnos y docentes se crean sin restricción
✅ JWT tokens con rol incluido

---

## 📡 Endpoints Disponibles

### 1️⃣ Crear Primer Administrador
```
POST /auth/crear-admin-inicial
```
**Cuerpo:**
```json
{
  "name": "Admin Principal",
  "email": "admin@admin.buap.mx",
  "password": "admin123"
}
```
**Respuesta (200):**
```json
{
  "message": "Administrador creado exitosamente",
  "user": {
    "id": "usr_a1b2c3d4",
    "name": "Admin Principal",
    "email": "admin@admin.buap.mx",
    "role": "admin"
  }
}
```

---

### 2️⃣ Login (Obtener JWT Token)
```
POST /auth/login
```
**Cuerpo:**
```json
{
  "email": "admin@admin.buap.mx",
  "password": "admin123"
}
```
**Respuesta (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "admin"
}
```

---

### 3️⃣ Crear Usuario (Alumno, Docente, o Nuevo Admin)
```
POST /auth/crear
```

**Para Alumno (sin token):**
```json
{
  "name": "Carlos López",
  "email": "carlos@alumno.buap.mx",
  "password": "pass123"
}
```

**Para Docente (sin token):**
```json
{
  "name": "Prof. María",
  "email": "maria@correo.buap.mx",
  "password": "pass123"
}
```

**Para Nuevo Admin (CON token):**
```json
{
  "name": "Segundo Admin",
  "email": "otro@admin.buap.mx",
  "password": "admin456"
}
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

---

### 4️⃣ Verificar si existe Administrador
```
GET /auth/admin-existe
```
**Respuesta:**
```json
{
  "existe": true,
  "totalAdmins": 1
}
```

---

### 5️⃣ Obtener Usuario por ID (gRPC)
```
gRPC: AuthService.GetUserById
```
**Entrada:**
```json
{
  "user_id": "usr_a1b2c3d4"
}
```

---

## 🚀 Cómo Iniciar el Proyecto

### 1. Instalar Dependencias
```bash
cd ms-auth
npm install
```

### 2. Configurar Variables de Entorno
```bash
# .env (o variables de Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=adminpassword
DB_DATABASE=agm_auth_db
```

### 3. Iniciar en Desarrollo
```bash
npm run start:dev
```

### 4. Compilar para Producción
```bash
npm run build
npm run start:prod
```

---

## 📊 Flujo de Ejemplo Completo

### Paso 1: Crear primer admin
```bash
curl -X POST http://localhost:3001/auth/crear-admin-inicial \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin Principal",
    "email": "admin@admin.buap.mx",
    "password": "admin123"
  }'
```

### Paso 2: Hacer login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.buap.mx",
    "password": "admin123"
  }'
```
**Guardar el `access_token` como `TOKEN`**

### Paso 3: Crear alumno (sin token)
```bash
curl -X POST http://localhost:3001/auth/crear \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Alumno",
    "email": "juan@alumno.buap.mx",
    "password": "pass123"
  }'
```

### Paso 4: Crear segundo admin (CON token)
```bash
curl -X POST http://localhost:3001/auth/crear \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Segundo Admin",
    "email": "otro@admin.buap.mx",
    "password": "admin456"
  }'
```

---

## 🔒 Reglas de Seguridad

| Acción | Dominio | Token Requerido | Condición |
|--------|---------|---|---|
| Crear 1er admin | @admin.buap.mx | ❌ No | Solo si NO existe admin |
| Crear otro admin | @admin.buap.mx | ✅ Sí (admin) | Solo si existe admin |
| Crear docente | @correo.buap.mx | ❌ No | Siempre |
| Crear alumno | @alumno.buap.mx | ❌ No | Siempre |

---

## 💾 Base de Datos

### Tabla: user
```sql
CREATE TABLE "user" (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  role VARCHAR NOT NULL  -- 'admin', 'docente', 'alumno'
);
```

---

## 🐛 Errores Comunes

### ❌ "Ya existe un administrador en el sistema"
**Causa:** Intentas usar `/crear-admin-inicial` pero ya existe un admin
**Solución:** Usa `/crear` con token de admin

### ❌ "¡Alto! Necesitas enviar el Token de un Administrador"
**Causa:** Intentas crear admin sin enviar el header `Authorization`
**Solución:** Agrega `Authorization: Bearer <TOKEN>` a los headers

### ❌ "Tu token es válido, pero no tienes permisos de Administrador"
**Causa:** El token es de un alumno/docente, no de admin
**Solución:** Usa el token del admin

### ❌ "Token inválido o expirado"
**Causa:** El token expiró (duraban 2 horas) o está malformado
**Solución:** Haz login de nuevo para obtener nuevo token

---

## ✨ Características Implementadas

✅ JWT Authentication
✅ Base de datos PostgreSQL con TypeORM
✅ gRPC microservice support
✅ Admin único del sistema
✅ Roles: admin, docente, alumno
✅ Hashing de contraseñas con bcrypt
✅ Validación de dominios BUAP
✅ IDs generados aleatoriamente
✅ Manejo de errores completo

---

**Estado:** ✅ Listo para usar
**Versión:** 1.0.0
**Última actualización:** 22 de abril de 2026
