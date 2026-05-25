# 🧪 Plan de Testing del Flujo Completo RabbitMQ

## 1️⃣ PREPARACIÓN DEL ENTORNO

### A. Requisitos previos

```bash
✅ Docker y Docker Compose instalados
✅ Node.js 18+ para compilar microservicios
✅ Git configurado
✅ Postman o curl para hacer requests
```

### B. Iniciar los containers

```bash
cd agm-colaborativo
docker compose up -d

# Verificar que todos estén corriendo
docker compose ps
```

**Servicios que deberían estar corriendo:**

- ✅ agm_postgres (5432)
- ✅ agm_mongo (27017)
- ✅ agm_redis (6379)
- ✅ agm_rabbitmq (5672, 15672)
- ✅ agm_ms_auth (3000, 5000)
- ✅ agm_ms_alumnos (3002, 5002)
- ✅ agm_ms_calificaciones (3003, 5003)
- ✅ agm_ms_asistencias (3005, 5005)
- ✅ agm_ms_periodos (3004, 5004)
- ✅ agm_ms_notificaciones (3006)

### C. Verificar RabbitMQ Management UI

```
URL: http://localhost:15672
Usuario: agm_user
Contraseña: agm_password
Virtual Host: /agm
```

---

## 2️⃣ PRUEBAS UNITARIAS: Validación de Inscripción

### Escenario 1: Inscripción Exitosa (Happy Path)

```bash
# 1. Crear un alumno
curl -X POST http://localhost:3002/alumnos \
  -H "Content-Type: application/json" \
  -d '{
    "matricula": "ALU001",
    "nombre": "Juan Pérez",
    "carrera": "ITIS"
  }'

# 2. Inscribir materia (caso exitoso)
curl -X POST http://localhost:3002/alumnos/inscribir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "matricula_alumno": "ALU001",
    "nrc_materia": "12345"
  }'

# ✅ Esperado:
# - Status 200 OK
# - Response: { message: "¡Inscripción exitosa!", inscripcion: {...} }
# - RabbitMQ: alumno.inscrito event publicado
```

### Escenario 2: Inscripción Duplicada (Validación)

```bash
# Intentar inscribir el mismo alumno en la misma materia
curl -X POST http://localhost:3002/alumnos/inscribir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "matricula_alumno": "ALU001",
    "nrc_materia": "12345"
  }'

# ✅ Esperado:
# - Status 200 (no error, pero rechazado)
# - Message: "El alumno ya se encuentra inscrito activamente..."
# - RabbitMQ: inscripcion.rechazada event (motivo: 'ya_inscrito')
# - ms-notificaciones: Log warning sobre rechazo
```

### Escenario 3: Carga Excedida (Validación)

```bash
# Inscribir alumno en 4 materias (24 créditos > 18 máximo)
for i in {1..4}; do
  curl -X POST http://localhost:3002/alumnos/inscribir \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <JWT_TOKEN>" \
    -d "{
      \"matricula_alumno\": \"ALU002\",
      \"nrc_materia\": \"1000$i\"
    }"
done

# En la 4ª inscripción:
# ✅ Esperado:
# - Message: "No puede inscribirse: Superaría la carga máxima..."
# - RabbitMQ: inscripcion.rechazada event (motivo: 'carga_excedida')
# - Details: Incluye créditos actuales (18) y máximo (18)
```

### Escenario 4: Materia Llena (Part 8)

```bash
# Inscribir 40 alumnos en la misma materia
for i in {1..40}; do
  # Crear alumno temporal
  curl -X POST http://localhost:3002/alumnos \
    -H "Content-Type: application/json" \
    -d "{\"matricula\": \"ALU_TEMP_$i\", \"carrera\": \"ITIS\"}"

  # Inscribir
  curl -X POST http://localhost:3002/alumnos/inscribir \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <JWT_TOKEN>" \
    -d "{
      \"matricula_alumno\": \"ALU_TEMP_$i\",
      \"nrc_materia\": \"99999\"
    }"
done

# En la inscripción #40:
# ✅ Esperado:
# - Inscripción exitosa
# - RabbitMQ: alumno.inscrito event
# - RabbitMQ: materia.carga.llena event (inscritos_actuales: 40, capacidad: 40)
# - ms-notificaciones: Log warning sobre grupo lleno
```

---

## 3️⃣ FLUJO COMPLETO: Event Chain

### A. Cadena de Eventos Esperada

```
1. inscribirMateria()
   ↓
2. ✅ Validar inscripción duplicada → No publicar si duplicada
   ↓
3. ✅ Validar carga máxima (18 créditos) → No publicar si excedida
   ↓
4. ✅ Crear registro inscripción en DB
   ↓
5. 📤 Publicar: alumno.inscrito
   ├─ Consumer: ms-asistencias.onAlumnoInscrito()
   │  └─ Prepara grupo para asistencia (QR)
   ├─ Consumer: ms-calificaciones.onAlumnoInscrito()
   │  └─ Crea registro inicial de calificación
   └─ Consumer: ms-periodos.onAlumnoInscrito()
      └─ Asocia alumno a grupo
   ↓
6. ✅ Verificar capacidad (40 max)
   ↓
7. 📤 Publicar: materia.carga.llena (si inscritos === 40)
   └─ Consumer: ms-notificaciones.onMateriaCargaLlena()
      └─ Alerta sobre grupo lleno
```

### B. Verificar con RabbitMQ Management UI

```
1. Ir a: http://localhost:15672
2. Pestaña: Queues
3. Verificar estas colas:
   ✅ asistencias.queue
   ✅ calificaciones.queue
   ✅ notificaciones.queue
   ✅ periodos.queue
   ✅ alumnos.queue
   ✅ auditor.queue
   ✅ dlq.default (Dead Letter Queue)

4. Pestaña: Exchanges
   ✅ agm.events (tipo: topic)
   ✅ Bindings a cada cola con routing keys:
      - asistencias.queue: alumno.inscrito, alumno.desinscrito, etc.
      - calificaciones.queue: alumno.inscrito, asistencia.resumen.calculado, etc.
      - notificaciones.queue: alumno.inscrito, calificacion.final.asignada,
                             asistencia.resumen.calculado, inscripcion.rechazada,
                             materia.carga.llena

5. Pestaña: Connections
   ✅ 5+ conexiones (una por cada microservicio)

6. Enviar mensaje de prueba:
   - Exchange: agm.events
   - Routing key: test.message
   - Payload: {"test": "mensaje"}
   - Debería llegar a dlq.default (Dead Letter Queue)
```

---

## 4️⃣ VERIFICACIÓN DE LOGS

### A. Logs de ms-alumnos

```bash
docker logs agm_ms_alumnos -f

# Eventos esperados:
✅ "📤 Evento alumno.inscrito publicado en RabbitMQ"
✅ "🚨 ALERTA: Materia XXXXX alcanzó capacidad máxima (40/40)"
⚠️ "📧 Notificación: Inscripción rechazada para ALU002 - Motivo: ya_inscrito"
⚠️ "Carga actual: 18 créditos. Máximo permitido: 18 créditos."
```

### B. Logs de ms-notificaciones

```bash
docker logs agm_ms_notificaciones -f

# Eventos esperados:
✅ "📨 Mensaje recibido: alumno.inscrito"
✅ "📧 Notificación: Inscripción rechazada para ALU001 - Motivo: ya_inscrito"
✅ "📧 Notificación: Materia XXXXX alcanzó capacidad máxima"
✅ "ℹ️ ALU001 ya estaba inscrito en 12345"
✅ "⚠️ ALU002 superó carga máxima: Carga actual: 24 créditos..."
```

### C. Logs de ms-asistencias

```bash
docker logs agm_ms_asistencias -f

# Eventos esperados:
✅ "Consumidor iniciado para: alumno.inscrito"
✅ "Se preparó grupo para QR tracking del alumno ALU001"
```

### D. Logs de ms-calificaciones

```bash
docker logs agm_ms_calificaciones -f

# Eventos esperados:
✅ "Consumidor iniciado para: alumno.inscrito"
✅ "Se creó registro inicial de calificación para ALU001"
```

---

## 5️⃣ CHECKLIST DE VALIDACIÓN

### ✅ Estructura de Datos

- [ ] Inscripcion.entity.ts tiene campo `estatus` (línea ~18)
- [ ] InscripcionRechazadaEvent tiene campos: motivo, detalle, fecha_rechazo
- [ ] MateriaCargaLlenaEvent tiene campos: inscritos_actuales, capacidad_maxima

### ✅ Eventos Publicados

- [ ] alumno.inscrito: Se publica después de crear inscripción exitosa
- [ ] inscripcion.rechazada: Se publica cuando:
  - [ ] Alumno ya está inscrito (motivo: 'ya_inscrito')
  - [ ] Carga excedida (motivo: 'carga_excedida')
- [ ] materia.carga.llena: Se publica cuando inscritos === 40

### ✅ Eventos Consumidos

- [ ] ms-asistencias escucha: alumno.inscrito
- [ ] ms-calificaciones escucha: alumno.inscrito
- [ ] ms-periodos escucha: alumno.inscrito
- [ ] ms-notificaciones escucha:
  - [ ] alumno.inscrito
  - [ ] inscripcion.rechazada
  - [ ] materia.carga.llena
  - [ ] calificacion.final.asignada
  - [ ] asistencia.resumen.calculado

### ✅ Validaciones Implementadas

- [ ] Validación de inscripción duplicada
  - [ ] Busca en DB: matricula + nrc + estatus='activo'
  - [ ] Publica evento rechazo si existe
- [ ] Validación de carga máxima (18 créditos)
  - [ ] Cuenta inscripciones activas
  - [ ] Calcula: inscritos \* 6 créditos por materia
  - [ ] Rechaza si total + 6 > 18
- [ ] Detección de capacidad llena (40 estudiantes)
  - [ ] Cuenta inscripciones para nrc_materia después de crear
  - [ ] Publica evento si count === 40

### ✅ Error Handling

- [ ] RabbitMQ connection failures no crashean microservicios
- [ ] Eventos rechazados no lanzan excepciones, devuelven mensaje
- [ ] Dead Letter Queue recibe eventos que fallan 3 veces

---

## 6️⃣ PRUEBAS DE ESTRÉS (Opcional)

```bash
# Simular 100 inscripciones concurrentes
ab -n 100 -c 10 -p inscribir_payload.json \
   -H "Content-Type: application/json" \
   http://localhost:3002/alumnos/inscribir

# Verificar:
- [ ] No hay race conditions
- [ ] RabbitMQ no pierde eventos
- [ ] Dead Letter Queue vacía (sin eventos fallidos)
- [ ] Todas las inscripciones exitosas están en BD
```

---

## 7️⃣ PROBLEMAS COMUNES Y SOLUCIONES

### ❌ "Error: ECONNREFUSED 127.0.0.1:5672"

**Causa:** RabbitMQ no está corriendo o no es accesible
**Solución:**

```bash
docker compose ps  # Ver estado
docker compose logs rabbitmq  # Ver errores
docker compose restart rabbitmq
```

### ❌ "No se puede conectar con MS-Notificaciones"

**Causa:** Microservicio not running o no alcanzable
**Solución:**

```bash
docker compose logs ms-notificaciones
docker compose restart ms-notificaciones
```

### ❌ Eventos no llegan a consumers

**Causa:** Bindings no configurados correctamente
**Solución:**

1. Ir a RabbitMQ Management UI
2. Verificar que las colas estén bindeadas al exchange agm.events
3. Verificar routing keys en rabbitmq.listener.ts

### ❌ "Inscripción rechazada pero sin evento en RabbitMQ"

**Causa:** publishEvent() falla silenciosamente
**Solución:**

1. Revisar console.error en logs
2. Verificar RABBITMQ_URL es correcta
3. Verificar autenticación en RabbitMQ (usuario/contraseña)

---

## 📊 Métrica de Éxito

```
✅ 100% = Todos los escenarios pasan sin errores
  - 20 eventos alumno.inscrito publicados
  - 5 eventos inscripcion.rechazada (duplicados)
  - 3 eventos inscripcion.rechazada (carga excedida)
  - 1 evento materia.carga.llena
  - 0 eventos en Dead Letter Queue
  - Todos los logs muestran transiciones esperadas
```

---

## 🚀 Próximos Pasos Después del Testing

1. **Si todo funciona:** Documentar en README.md
2. **Si hay errores:**
   - Revisar rabbitmq.listener.ts bindings
   - Verificar que todos los microservicios tienen RABBITMQ_URL
   - Aumentar logs con debug statements
3. **Parte 9:** Implementar event retry logic y mejorar error handling
