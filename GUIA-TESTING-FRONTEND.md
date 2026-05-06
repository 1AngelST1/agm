# 🧪 Guía de Testing - Frontend AGM

## 📋 Antes de Empezar

Asegúrate de que:
1. ✅ Los 3 microservicios estén corriendo (ms-auth, ms-alumnos, ms-calificaciones)
2. ✅ PostgreSQL esté funcionando
3. ✅ El frontend está compilado

```bash
# Terminal 1 - ms-auth
cd ms-auth
npm run start

# Terminal 2 - ms-alumnos  
cd ms-alumnos
npm run start

# Terminal 3 - ms-calificaciones
cd ms-calificaciones
npm run start

# Terminal 4 - frontend (dev server)
cd frontend
npm start
# Abre http://localhost:4200
```

---

## 👨‍💼 TEST 1: PORTAL DEL PROFESOR

### 1.1 Login como Profesor
**Datos:**
```
Email: profesor1@correo.buap.mx
Password: profesor123
```

**Esperado:**
- ✅ Redirecciona a `/portal-docente`
- ✅ Muestra "📚 Mis Grupos"
- ✅ Muestra tarjetas de grupos asignados

---

### 1.2 Ver Alumnos del Grupo
**Paso:**
1. Presionar botón **"Ver Alumnos"** en cualquier grupo

**Esperado:**
- ✅ Se abre modal con título "👥 Lista de Alumnos"
- ✅ Muestra tabla con columnas: Matrícula, Calificación, Estatus, Acción
- ✅ Al menos 1 alumno visible

---

### 1.3 Editar Calificación (EL PRINCIPAL PROBLEMA RESUELTO)
**Paso:**
1. En el modal de alumnos, presionar **"✏️ Editar"** en cualquier fila
2. Cambiar el valor en "Nueva Calificación (0-10)"
3. Presionar **"💾 Actualizar Calificación"**

**Debugging en Consola (F12):**
```
Busca logs como:
📤 Enviando PUT: { url: "/calificaciones/50130/202253882", body: {...} }
✅ Calificación actualizada exitosamente: {...}
```

**Esperado:**
- ✅ Modal se cierra automáticamente
- ✅ La tabla se actualiza con el nuevo valor
- ✅ Sin redirección al inicio (este era el bug)
- ✅ Calificación muestra el nuevo valor

**Si falla:**
```
❌ Errores esperados en consola:
- "Error: nrc_grupo no disponible" → Problema de datos
- "Error: No se encontró la calificación" → Problema de recarga
```

---

### 1.4 Insertar Nueva Calificación
**Paso:**
1. En tarjeta de grupo, presionar **"+ Calificación"**
2. Ingresar matrícula de alumno (ej: 202253882)
3. Ingresar calificación (0-10)
4. Presionar **"💾 Guardar Calificación"**

**Esperado:**
- ✅ Modal se cierra
- ✅ La tabla se actualiza mostrando el nuevo registro
- ✅ Sin redirección

**Validaciones:**
- ⚠️ Si intentas insertar calificación 0-10 → Aceptada
- ⚠️ Si intentas insertar calificación >10 → Error: "debe estar entre 0 y 10"
- ⚠️ Si intentas sin matrícula → Error: "Ingresa la matrícula"
- ⚠️ Si intentas alumno inexistente → Error desde backend

---

### 1.5 Eliminar Calificación
**Paso:**
1. En modal de alumnos, presionar **"🗑️ Eliminar"** en cualquier fila
2. Confirmar en el `confirm()` del navegador

**Esperado:**
- ✅ Se elimina de la tabla
- ✅ La tabla se recarga automáticamente
- ✅ Sin errores

---

## 🎓 TEST 2: PORTAL DEL ALUMNO (NUEVO)

### 2.1 Login como Alumno
**Datos:**
```
Email: alumno1@alumno.buap.mx
Password: alumno123
```

**Esperado:**
- ✅ Redirecciona a `/portal-alumno`
- ✅ Muestra "🎓 Portal del Alumno"
- ✅ Muestra header con email del alumno
- ✅ Muestra tarjeta con datos personales

---

### 2.2 Ver Datos Personales
**Esperado:**
```
📧 Correo: alumno1@alumno.buap.mx
🆔 Matrícula: 202253882
🎓 Carrera: Ingeniería en Sistemas Computacionales
✅ Estado: Activo
```

---

### 2.3 Ver Kardex (NUEVO FEATURE)
**Esperado Estadísticas:**
```
Total Materias: 3 (ej)
Promedio: 7.5 (ej)
Aprobadas: 2
Reprobadas: 0
En Curso: 1
```

**Esperado Tabla:**
| Materia | NRC | Sección | Período | Calificación | Estatus |
|---------|-----|---------|---------|--------------|---------|
| Cálculo Diferencial | 50130 | 1 | 2024-1 | 8.5 | ✅ Aprobado |
| Física I | 50135 | 2 | 2024-1 | 0 | 📝 Cursando |

**Colores Esperados:**
- 🟢 Verde = Aprobado (≥6)
- 🔴 Rojo = Reprobado (0 < x < 6)
- 🟡 Amarillo = Cursando (=0)

---

### 2.4 Verificar Solo Lectura
**Esperado:**
- ✅ NO hay botones de editar
- ✅ NO hay botones de eliminar
- ✅ Solo puede ver sus datos (calificaciones de su propia matrícula)

---

## 🔴 TROUBLESHOOTING

### Problema: "Modal de edición se cierra pero no actualiza"
**Verificar:**
1. Abre DevTools (F12)
2. Ve a Console tab
3. Intenta editar
4. Busca logs que empiezan con 📤, 📝, ❌
5. Verifica que diga: `✅ Calificación actualizada exitosamente`

**Si ves error:**
```
❌ Error: nrc_grupo no disponible
```
→ Significa que el backend no está devolviendo `nrc_grupo` correctamente
→ Necesita revisar: ms-calificaciones/src/app.controller.ts línea ~595

---

### Problema: "Alumno no ve su kardex"
**Verificar:**
1. El token JWT del alumno contiene `sub: matricula_alumno`
2. El backend devuelve calificaciones para esa matrícula
3. En DevTools, ve a Network → Busca `GET /kardex/mi-kardex`
4. Verifica la response

**Si la response está vacía:**
→ No hay calificaciones registradas para este alumno
→ Necesitas crear una calificación como profesor primero

---

### Problema: "Ruta 'portal-alumno' no existe"
**Solución:**
Verifica que en `app.routes.ts` exista:
```typescript
{
  path: 'portal-alumno',
  component: DashboardAlumno,
  canActivate: [RoleGuard],
  data: { role: 'alumno' }
}
```

---

## ✅ CHECKLIST DE VALIDACIÓN

```
PROFESOR:
□ Login correcto
□ Ve sus grupos
□ Ve alumnos en grupo
□ Editar calificación NO regresa al inicio
□ Tabla se actualiza después de editar
□ Insertar nueva calificación funciona
□ Eliminar calificación funciona

ALUMNO:
□ Login correcto
□ Ve sus datos personales
□ Ve su kardex completo
□ Tabla muestra todas sus calificaciones
□ Estadísticas (promedio, etc) son correctas
□ Colores de estatus correctos
□ NO puede editar/eliminar (solo lectura)

BACKEND:
□ No hay errores 500 en la consola
□ Todas las respuestas 200/201
□ Logs muestran los PUTs, POSTs, DELETEs correcto
```

---

## 📞 SI ALGO FALLA

1. **Revisa los logs en consola:**
   ```
   DevTools (F12) → Console tab
   ```

2. **Revisa los logs del backend:**
   ```
   Terminal donde corre npm run start:dev
   Busca líneas que comienzan con ✅, ❌, 📝, 📤
   ```

3. **Limpia cache del navegador:**
   ```
   DevTools (F12) → Application → Clear Storage
   ```

4. **Compila de nuevo el frontend:**
   ```bash
   npm run build
   ```

5. **Reinicia los servicios:**
   ```bash
   Detén todos los npm (Ctrl+C)
   Espera 2 segundos
   Reinicia cada uno
   ```

---

## 🎉 RESUMEN

✅ **Profesor puede:** Ver grupos, ver alumnos, insertar/editar/eliminar calificaciones
✅ **Alumno puede:** Ver sus datos, ver su kardex, ver sus materias (solo lectura)
✅ **Bug RESUELTO:** Editar calificación ya NO regresa al inicio
