# 🔧 TROUBLESHOOTING - Errores Frecuentes

## ❌ PROBLEMA: "Error 404 en GET /calificaciones/kardex/mi-kardex"

### Causa
El backend NO tiene actualizado el endpoint o no compila correctamente los cambios.

### Solución - PASOS EXACTOS:

#### 1️⃣ Detener ms-calificaciones
```bash
# En la terminal donde corre ms-calificaciones
Ctrl+C
```

#### 2️⃣ Verificar que los cambios se guardaron
```bash
# Verificar que el archivo tiene el nuevo método gRPC
cd ms-calificaciones/src
grep -n "GetAlumnoByUserId" app.controller.ts
# Debe mostrar la línea donde está GetAlumnoByUserId
```

#### 3️⃣ Limpiar y compilar de nuevo
```bash
cd ms-calificaciones
rm -rf dist/
npm run build
```

#### 4️⃣ Reiniciar el servicio
```bash
npm run start:dev
# Debe mostrar:
# ✓ listening on port 3003
```

#### 5️⃣ Verificar en el navegador
- Abre DevTools (F12)
- Ve a Application → Local Storage
- **Elimina todo** (Clear All)
- Recarga la página (Ctrl+Shift+R)
- Intenta login como alumno

---

## ❌ PROBLEMA: "Alumno ve error 'No tienes calificaciones'"

### Causa 1: No hay datos en la BD
**Verificar:**
```bash
# En pgAdmin (http://localhost:5050)
# Base de datos: public.agm_calificaciones_db
# Tabla: calificaciones

SELECT * FROM calificaciones;
```

**Si está vacía:**
1. Login como profesor
2. Crear un grupo
3. Insertar una calificación para el alumno

---

### Causa 2: El alumno existe pero no tiene matrícula
**Verificar:**
```bash
# En pgAdmin
SELECT * FROM alumnos WHERE user_id = 'el-user-id-del-alumno';
```

**Si matricula es NULL:**
```bash
# Necesitas actualizar manualmente:
UPDATE alumnos SET matricula = '202253882' WHERE user_id = 'xxx';
```

---

### Causa 3: El error de gRPC entre microservicios
**Verificar en consola de ms-calificaciones:**
```
🔍 Buscando alumno con user_id: xxx
❌ Error gRPC al obtener alumno: ...
```

**Si ves este error:**
1. Asegúrate que ms-alumnos esté corriendo
2. En ms-alumnos, verifica que existe: `@GrpcMethod('AlumnosService', 'GetAlumnoByUserId')`
3. En proto/alumnos.proto verifica que existe el RPC method

---

## ❌ PROBLEMA: "Profesor edita pero no se guarda"

### Causa 1: Validación en el frontend
**Verificar en DevTools Console:**
```
Busca líneas que digan:
❌ Error: nrc_grupo no disponible
❌ Error: No se encontró la calificación
```

**Solución:**
1. Abre la lista de alumnos
2. Presiona F12 → Console
3. Intenta editar
4. Busca logs que comiencen con 📤, 📝, ❌
5. Si dice "nrc_grupo no disponible" → Problema de datos en la tabla

### Causa 2: Error en el backend
**Verificar en la consola de ms-calificaciones:**
```
Busca líneas como:
7️⃣ Creando calificación con estatus: Aprobado
8️⃣ Guardando en BD...
❌ Error capturado: ...
```

**Si ves error:**
1. Verifica que el endpoint PUT existe:
   ```bash
   grep -n "@Put(':nrc/:matricula')" ms-calificaciones/src/app.controller.ts
   ```

2. Verifica que la calificación existe:
   ```bash
   # En pgAdmin
   SELECT * FROM calificaciones 
   WHERE matricula_alumno = '202253882' AND nrc_grupo = '50130';
   ```

---

## ✅ CHECKLIST: Verificar que TODO está correcto

### Backend - ms-alumnos
```
✅ [ ] Existe método GetAlumnoByUserId
       grep -n "GetAlumnoByUserId" ms-alumnos/src/app.controller.ts

✅ [ ] Proto actualizado con nuevo RPC
       grep -n "GetAlumnoByUserId" proto/alumnos.proto

✅ [ ] Servicio compila sin errores
       npm run build
```

### Backend - ms-calificaciones
```
✅ [ ] Interfaz AlumnosServiceClient tiene GetAlumnoByUserId
       grep -n "GetAlumnoByUserId" ms-calificaciones/src/app.controller.ts

✅ [ ] Endpoint verMiKardex usa gRPC correctamente
       grep -A5 "GetAlumnoByUserId" ms-calificaciones/src/app.controller.ts

✅ [ ] Endpoint devuelve array (no excepción)
       grep -B2 "return misCalificaciones" ms-calificaciones/src/app.controller.ts
```

### Frontend
```
✅ [ ] Servicio tiene obtenerMiKardex()
       grep -n "obtenerMiKardex" frontend/src/app/core/services/calificaciones.service.ts

✅ [ ] Componente inicializa kardex como array
       grep "kardex = signal" frontend/src/app/pages/alumno/dashboard-alumno/dashboard-alumno.ts

✅ [ ] HTML verifica Array.isArray correctamente
       grep "*ngIf=\"kardex()" frontend/src/app/pages/alumno/dashboard-alumno/dashboard-alumno.html
```

---

## 🔍 DEBUGGING STEP-BY-STEP

### 1. Verifica que el token es correcto
```javascript
// En DevTools Console:
localStorage.getItem('token')
// Debe mostrar: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Decodifica el token
```javascript
// Copiar este código en DevTools Console:
const token = localStorage.getItem('token');
const parts = token.split('.');
const decoded = JSON.parse(atob(parts[1]));
console.log(decoded);

// Debe mostrar algo como:
// {sub: "uuid-del-usuario", email: "alumno1@alumno.buap.mx", role: "alumno", iat: 1...}
```

### 3. Verifica que la matrícula existe en BD
```sql
-- En pgAdmin, ejecutar:
SELECT * FROM alumnos WHERE user_id = 'uuid-del-usuario';
-- Debe mostrar la matrícula (ej: 202253882)
```

### 4. Verifica que hay calificaciones
```sql
-- En pgAdmin, ejecutar:
SELECT * FROM calificaciones WHERE matricula_alumno = '202253882';
-- Debe mostrar 1 o más filas
```

---

## 📊 Diagrama de Flujo

```
Login (alumno@alumno.buap.mx)
    ↓
Token JWT generado: { sub: user_id, email, role }
    ↓
GET /calificaciones/kardex/mi-kardex
    ↓ (con Authorization: Bearer token)
ms-calificaciones recibe request
    ↓
Extrae user_id del token: req.user.userId
    ↓
Llama gRPC: GetAlumnoByUserId({ user_id })
    ↓ (a ms-alumnos)
ms-alumnos devuelve: { matricula: 202253882, ... }
    ↓
ms-calificaciones busca: calificaciones WHERE matricula_alumno = 202253882
    ↓
Devuelve array (vacío o con datos)
    ↓
Frontend recibe array
    ↓
Si array.length > 0: Muestra tabla
Si array.length === 0: Muestra "Sin calificaciones"
```

---

## 🆘 Si nada funciona

### Nuclear Option - Resetear todo
```bash
# 1. Detener todos los servicios
# 2. En ms-alumnos:
npm run build

# 3. En ms-calificaciones:
npm run build

# 4. Limpiar caché del navegador:
# DevTools → Application → Storage → Clear All

# 5. Reiniciar los servicios en orden:
# Terminal 1: cd ms-auth && npm run start:dev
# Terminal 2: cd ms-alumnos && npm run start:dev
# Terminal 3: cd ms-calificaciones && npm run start:dev
# Terminal 4: cd frontend && npm start

# 6. Login como alumno nuevamente
```

---

## 💡 Tips de Debugging

1. **Siempre revisa la consola del navegador (F12)**
   - Ve a Console tab
   - Busca líneas rojas (errores)

2. **Siempre revisa la consola del backend**
   - Donde corre `npm run start:dev`
   - Busca líneas con 📤, ✅, ❌

3. **Si cambias código TypeScript:**
   - Puede que necesites `npm run build`
   - Y reiniciar el servicio

4. **Si cambias el proto file:**
   - Necesitas rebuild de AMBOS microservicios
   - ms-alumnos: `npm run build`
   - ms-calificaciones: `npm run build`

5. **Si cambias el frontend:**
   - La página se recarga automáticamente (webpack watches)
   - Pero limpia caché con Ctrl+Shift+R

---

## 📞 Información para Compartir si Pides Ayuda

Cuando pidas ayuda, comparte:
1. Screenshot de DevTools Console (errores)
2. Screenshot de la terminal donde corre ms-calificaciones
3. El resultado de:
   ```sql
   SELECT * FROM calificaciones LIMIT 5;
   SELECT * FROM alumnos LIMIT 5;
   ```
4. El resultado de decodificar el token (ver punto 2 arriba)
