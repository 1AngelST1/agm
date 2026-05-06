# 📋 Guía de Pruebas: CRUD de Calificaciones en Postman

## 🔑 Requisitos Previos
1. **Token JWT válido** de un profesor (role: 'docente')
2. Los 3 microservicios corriendo:
   - ms-auth (puerto 3001)
   - ms-alumnos (puerto 3002)
   - ms-calificaciones (puerto 3003)
3. Base de datos con datos de prueba:
   - Grupo con NRC: `50130` (Servicios Web)
   - Alumno con matrícula: `202253882`

---

## ✅ PASO 1: LOGIN (Obtener Token)

### Request:
```
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "profesor@buap.edu.mx",
  "password": "profesor123"
}
```

### Response esperada:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "user": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "profesor@buap.edu.mx",
    "role": "docente"
  }
}
```

**⚠️ Copia el `access_token` y úsalo en todas las siguientes peticiones en el header:**
```
Authorization: Bearer {access_token}
```

---

## 📝 PASO 2: INSERTAR Calificación (POST)

### Request:
```
POST http://localhost:3003/calificaciones/calificar
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "nrc_grupo": "50130",
  "matricula_alumno": "202253882",
  "calificacion_ordinaria": 8.5
}
```

### Response esperada (201 Created):
```json
{
  "matricula_alumno": "202253882",
  "nrc_grupo": "50130",
  "calificacion_ordinaria": 8.5,
  "estatus": "Aprobado",
  "grupo": {
    "nrc": "50130",
    "materia": {
      "clave": "ITIS 260",
      "nombre": "Servicios Web"
    }
  }
}
```

**✅ Validaciones que ocurren:**
- ✓ Verifica que el usuario es docente o admin
- ✓ Busca que el grupo (NRC 50130) existe
- ✓ **Valida con gRPC** que la matrícula existe en ms-alumnos
- ✓ Calcula automáticamente: estatus = "Aprobado" (porque 8.5 >= 6)

**❌ Errores posibles:**
- 401: Token inválido o usuario no es docente
- 404: Grupo no encontrado
- 400: Alumno no existe (fallo en gRPC)

---

## ✏️ PASO 3: EDITAR Calificación (PUT)

Usa la matricula y NRC de la calificación creada: matricula=`202253882`, nrc=`50130`

### Request:
```
PUT http://localhost:3003/calificaciones/50130/202253882
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "calificacion_ordinaria": 7.5
}
```

### Response esperada (200 OK):
```json
{
  "matricula_alumno": "202253882",
  "nrc_grupo": "50130",
  "calificacion_ordinaria": 7.5,
  "estatus": "Aprobado",
  "grupo": {
    "nrc": "50130",
    "materia": { ... }
  }
}
```

**✅ Validaciones que ocurren:**
- ✓ Verifica que el usuario es docente o admin
- ✓ Busca que la calificación existe por matricula+nrc
- ✓ Si es docente, verifica que es su grupo
- ✓ Recalcula estatus automáticamente

---

## 🗑️ PASO 4: ELIMINAR Calificación (DELETE)

### Request:
```
DELETE http://localhost:3003/calificaciones/50130/202253882
Authorization: Bearer {access_token}
```

### Response esperada (200 OK):
```json
{
  "message": "Calificación eliminada exitosamente",
  "matricula_alumno": "202253882",
  "nrc_grupo": "50130"
}
```

---

## 👥 PASO 5: CONSULTAR Alumnos del Grupo (GET)

### Request:
```
GET http://localhost:3003/calificaciones/grupo/50130/alumnos
Authorization: Bearer {access_token}
```

### Response esperada (200 OK):
```json
{
  "grupo": {
    "nrc": "50130",
    "materia": "Servicios Web",
    "seccion": "001",
    "periodo": "2024-1"
  },
  "totalAlumnos": 1,
  "alumnos": [
    {
      "id": "cal-id-1",
      "codigo": "cal_8xzl6jx6",
      "matricula_alumno": "202253882",
      "calificacion_ordinaria": 7.5,
      "estatus": "Aprobado"
    }
  ]
}
```

---

## 🔄 FLUJO COMPLETO DE PRUEBA (En Orden)

1. **Login** → Obtener token
2. **POST /calificar** → Insertar calificación (8.5)
3. **GET /grupo/:nrc/alumnos** → Ver que la calificación está en la lista
4. **PUT /:id** → Editar a 7.5
5. **GET /grupo/:nrc/alumnos** → Verificar que se actualizó
6. **DELETE /:id** → Eliminar la calificación
7. **GET /grupo/:nrc/alumnos** → Verificar que ya no aparece

---

## ⚠️ Casos de Error para Probar

### Caso 1: Usuario no autorizado (Alumno intenta calificar)
```
POST http://localhost:3003/calificaciones/calificar
Authorization: Bearer {token_alumno}
Body: { ... }

Response (401):
{
  "statusCode": 401,
  "message": "¡Acceso denegado! Solo administradores y docentes pueden calificar. Tu rol es: alumno"
}
```

### Caso 2: Grupo no existe
```
POST http://localhost:3003/calificaciones/calificar
Body: {
  "nrc_grupo": "99999",
  "matricula_alumno": "202253882",
  "calificacion_ordinaria": 8
}

Response (404):
{
  "statusCode": 404,
  "message": "El grupo con NRC 99999 no existe."
}
```

### Caso 3: Alumno no existe (gRPC falla)
```
POST http://localhost:3003/calificaciones/calificar
Body: {
  "nrc_grupo": "50130",
  "matricula_alumno": "999999999",
  "calificacion_ordinaria": 8
}

Response (400):
{
  "statusCode": 400,
  "message": "El alumno con matrícula 999999999 no fue encontrado en ms-alumnos."
}
```

### Caso 4: Docente intenta editar grupo de otro docente
```
PUT http://localhost:3003/calificaciones/id-de-otro-profesor
Body: { "calificacion_ordinaria": 5 }

Response (401):
{
  "statusCode": 401,
  "message": "No tienes permiso para editar calificaciones de otro docente."
}
```

---

## 🎯 Puntos Clave a Validar

✅ **Validaciones gRPC funcionan**
- Al insertar, valida que el alumno existe en ms-alumnos
- Las calificaciones se guardan solo si la matrícula es válida

✅ **Cálculo automático de estatus**
- Calificación >= 6 → "Aprobado"
- 0 < Calificación < 6 → "Reprobado"
- Calificación = 0 → "Cursando"

✅ **Seguridad**
- Solo admin y docentes pueden crear/editar/eliminar
- Los docentes NO pueden tocar grupos de otros docentes
- Los alumnos NO pueden acceder a estos endpoints

✅ **Integridad de datos**
- Las calificaciones tienen ID único
- El código (cal_XXXXXXXX) se genera automáticamente
- Los cambios se persisten en la BD

---

## 📦 Importar en Postman

Si quieres tener una colección lista, copia esta estructura:

**Nombre:** AGM - Calificaciones CRUD  
**Entorno:** Agregar variable `token` y `calificacion_id`

Y crea 5 requests con los ejemplos de arriba.
