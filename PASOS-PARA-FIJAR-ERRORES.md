# ⚡ PASOS EXACTOS PARA FIJAR LOS ERRORES

## 🔴 Problema 1: Error 404 en `/calificaciones/kardex/mi-kardex`

El backend no compila los cambios correctamente. Aquí están los pasos **EXACTOS**:

### Paso 1: Detener ms-calificaciones
```bash
# En la terminal donde corre ms-calificaciones (Terminal 3)
Ctrl+C
# Espera 3 segundos
```

### Paso 2: Recompilar ms-alumnos
```bash
cd ms-alumnos
npm run build
# Espera a que termine (debe decir: tsc compiled successfully)
```

### Paso 3: Recompilar ms-calificaciones
```bash
cd ../ms-calificaciones
npm run build
# Espera a que termine (debe decir: tsc compiled successfully)
```

### Paso 4: Iniciar ms-calificaciones
```bash
npm run start:dev
# Debe mostrar:
# [Nest] XXX - 05/05/2026, XX:XX:XX AM     LOG [InstanceLoader] ConfigModule dependencies initialized +XXXms
# [Nest] XXX - 05/05/2026, XX:XX:XX AM     LOG [NestMicroservice] Nest microservice successfully started
# El terminal quedará esperando...
```

### Paso 5: Limpiar caché del navegador
```
DevTools (F12) → Application → Storage → Clear All
```

### Paso 6: Reload la página
```
Ctrl+Shift+R (reload sin caché)
```

### Paso 7: Login como Alumno
```
Email: alumno1@alumno.buap.mx
Password: alumno123
```

**Resultado Esperado:**
- ✅ Ve sus datos personales
- ✅ Ve tabla de "Mi Kardex" 
- ✅ Si tiene calificaciones: Muestra la tabla
- ✅ Si no tiene calificaciones: Muestra mensaje "No tienes calificaciones"

---

## 🔴 Problema 2: Profesor No Puede Editar Calificación

El problema es que después de editar, algo sale mal. Aquí está la solución:

### Verificación 1: Estar en la consola del navegador
```
1. Abre DevTools: F12
2. Ve a la tab "Console"
3. **Mantén la consola abierta** mientras editas
```

### Verificación 2: Intenta Editar
```
1. Login como profesor: profesor1@correo.buap.mx / profesor123
2. Presiona "Ver Alumnos" en cualquier grupo
3. Presiona "✏️ Editar" en cualquier alumno
4. Cambia el valor de calificación (ej: de 4 a 7)
5. Presiona "💾 Actualizar Calificación"
```

### Verificación 3: Busca los Logs
En la consola del navegador busca lineas como:
```
📤 Enviando PUT: { url: "/calificaciones/50130/202253882", body: { calificacion_ordinaria: 7 }}
✅ Calificación actualizada exitosamente: {...}
```

**Si ves esto:** 👍 **FUNCIONA** - El modal se cierra y la tabla se actualiza

**Si NO ves esto o ves errores (❌):** 
```
Hay un problema en ms-calificaciones
Necesitas verificar los logs del backend
Ve a la terminal donde corre: npm run start:dev
```

### Verificación 4: Verificar BD directamente
Si quieres confirmar que sí se guardó en la BD:

```bash
# Abre pgAdmin: http://localhost:5050
# Usuario: admin@example.com / root
# Contraseña: root

# 1. En la izquierda: Databases → agm_calificaciones_db → Schemas → public → Tables → calificaciones
# 2. Click derecho → View/Edit Data → All Rows

# Debe mostrar una fila con:
# matricula_alumno: 202253882
# nrc_grupo: 50130
# calificacion_ordinaria: 7 (el nuevo valor)
# estatus: Aprobado (actualizado automáticamente)
```

---

## ✅ RESUMEN DE LO QUE SE CORRIGIÓ

| Problema | Solución | Verificar |
|----------|----------|-----------|
| Error 404 en /kardex/mi-kardex | Agregado gRPC GetAlumnoByUserId | Backend compiló cambios |
| Alumno no ve kardex | Backend ahora devuelve array vacío | Login como alumno → Ver tabla |
| Profesor no puede editar | Mejor validación y logging | Buscar logs en consola |

---

## 🚨 SI NADA FUNCIONA

### Option 1: Rebuild Completo
```bash
# Detener TODO (Ctrl+C en todas las terminales)

# Ms-auth
cd ms-auth
rm -rf dist/
npm run build
npm run start:dev

# Ms-alumnos (nueva terminal)
cd ms-alumnos
rm -rf dist/
npm run build
npm run start:dev

# Ms-calificaciones (nueva terminal)
cd ms-calificaciones
rm -rf dist/
npm run build
npm run start:dev

# Frontend (nueva terminal)
cd frontend
npm start
```

### Option 2: Resetear BD
```bash
# En pgAdmin (http://localhost:5050)
# Eliminar y recrear la BD:

# 1. Selecciona agm_calificaciones_db → Click derecho → Delete
# 2. Selecciona agm_alumnos_db → Click derecho → Delete
# 3. Reinicia ms-calificaciones y ms-alumnos
# 4. Las tablas se recrearán automáticamente
# 5. Crear datos de nuevo:
#    - Login como admin
#    - Crear alumno
#    - Crear profesor
#    - Crear grupo
#    - Insertar calificación
```

---

## 📝 Checklist Final

Después de hacer los pasos, verifica:

```
ALUMNO:
☐ Login correctamente
☐ Ve sus datos personales (correo, matrícula, carrera)
☐ Ve tabla de "Mi Kardex"
☐ Ve sus calificaciones (si las hay)
☐ Ve estadísticas (promedio, aprobadas, etc.)

PROFESOR:
☐ Login correctamente
☐ Ve sus grupos
☐ Ver Alumnos → Funciona
☐ Insertar calificación → Funciona (modal cierra, tabla actualiza)
☐ Editar calificación → Funciona (modal cierra, tabla actualiza)
☐ Eliminar calificación → Funciona (tabla actualiza)

BACKEND:
☐ No hay errores 500 en consola
☐ Logs muestran ✅ (éxito) en operaciones
☐ BD tiene datos guardados correctamente
```

---

## 📞 ¿Aún no funciona?

Proporciona:
1. Screenshot de los logs (consola de DevTools)
2. Screenshot de la terminal de ms-calificaciones
3. El resultado de ejecutar en pgAdmin:
   ```sql
   SELECT * FROM calificaciones LIMIT 5;
   SELECT * FROM alumnos LIMIT 5;
   SELECT * FROM grupos LIMIT 5;
   ```

Con esa información podré debuggear exactamente qué está fallando.
