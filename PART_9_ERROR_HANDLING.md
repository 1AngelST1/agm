# Part 9: Error Handling Mejorado - Retry Logic y Dead Letter Queue

## 🎯 Objetivo

Implementar un sistema robusto de manejo de errores en RabbitMQ que garantice la entrega de mensajes incluso cuando los servicios fallan temporalmente, con reintentos automáticos, exponential backoff y almacenamiento en Dead Letter Queue (DLQ) para mensajes irrecuperables.

## 📋 Contenido Implementado

### 1. ✅ Retry Logic con Exponential Backoff

**Archivo:** `ms-alumnos/src/rabbitmq.service.ts` (replicado a todos los servicios)

#### Características:

```typescript
// Reintentos automáticos con exponential backoff
async publishEventWithRetry(
  routingKey: string,
  payload: RabbitMQEventPayload,
  options: PublishOptions = {}
): Promise<void>
```

**Opciones configurables:**

- `maxRetries`: Número máximo de reintentos (default: 3)
- `retryDelayMs`: Delay inicial entre reintentos (default: 5000ms = 5 seg)
- `exponentialBackoff`: Usar backoff exponencial (default: true)

#### Algoritmo de Backoff:

```
Intento 1: Falla
Intento 2: Espera 5 segundos → 5,000 ms
Intento 3: Espera 10 segundos → 10,000 ms (2 × 5000)
Intento 4: Espera 20 segundos → 20,000 ms (2 × 10000)
Intento 5 (fallida): Enviar a DLQ después de 80,000 ms total
```

**Beneficios:**

- ✅ Resuelve fallos transitorios automáticamente
- ✅ No congestionan el broker con reintentos inmediatos
- ✅ Escalable: cada intento espera más tiempo

#### Ejemplo de Uso:

```typescript
// Publicación simple (usa reintentos por defecto)
await this.rabbitmqService.publishEvent("alumno.inscrito", eventoInscripcion);

// Publicación con opciones personalizadas
await this.rabbitmqService.publishEventWithRetry(
  "alumno.inscrito",
  eventoInscripcion,
  {
    maxRetries: 5, // Intentar 5 veces
    retryDelayMs: 2000, // Esperar 2 segundos entre intentos
    exponentialBackoff: true, // Backoff exponencial
  },
);
```

---

### 2. ✅ Dead Letter Queue (DLQ)

**Archivo:** `shared/rabbitmq.constants.ts`

#### Configuración DLQ:

```typescript
export const RABBITMQ_CONFIG = {
  // ...
  deadLetterExchange: "agm.events.dlx", // Exchange para mensajes fallidos
};

export const RABBITMQ_QUEUES = {
  DEAD_LETTER: "dlq.default", // Queue central de errores
};

export const RABBITMQ_RETRY_CONFIG = {
  MAX_RETRIES: 3, // 3 reintentos
  RETRY_DELAY_MS: 5000, // 5 segundos entre reintentos
  DLQ_MESSAGE_TTL_MS: 86400000, // 24 horas en DLQ
};
```

#### Estructura DLQ:

```
┌─────────────────────────────────────────┐
│ agm.events (Topic Exchange)             │
│ (Eventos normales)                      │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ alumno.inscrito    │
         │ materia.carga...   │
         │ calificacion.*     │
         └──────────┬─────────┘
                    │
         ┌──────────▼───────────┐
         │ Reintentos (1,2,3)   │
         │ Exponential Backoff  │
         └──────────┬───────────┘
                    │
       ┌────────────▼────────────┐
       │ Fallo después de 3 rein │
       │ tentos                  │
       └────────────┬────────────┘
                    │
    ┌───────────────▼──────────────┐
    │ agm.events.dlx (DLX)         │
    │ (Dead Letter Exchange)       │
    └────────────────┬─────────────┘
                     │
          ┌──────────▼───────────┐
          │ dlq.default (DLQ)    │
          │ TTL: 24 horas        │
          │ Mensajes irrecuperables
          └──────────────────────┘
```

#### Contenido de Mensaje en DLQ:

```json
{
  "originalRoutingKey": "alumno.inscrito",
  "payload": {
    "alumno_id": 123,
    "matricula": "A001",
    "nrc_materia": "10001",
    "periodo": "2024-1",
    "fecha_inscripcion": "2024-05-24T10:30:00Z"
  },
  "failureReason": "ECONNREFUSED: Connection refused at 127.0.0.1:5672",
  "failedAt": "2024-05-24T10:35:00Z",
  "retriesExhausted": true
}
```

---

### 3. ✅ DLQ Listener en ms-notificaciones

**Archivo:** `ms-notificaciones/src/rabbitmq.listener.ts`

#### Métodos Implementados:

```typescript
// Configurar y escuchar DLQ
private async setupDLQListener(): Promise<void>

// Procesar mensajes del DLQ
private async onDeadLetterReceived(dlqMessage: DLQMessage): Promise<void>
```

#### Flujo de Operación:

```
1. setupListeners()
   ├── Configurar bindings normales
   │   ├── alumno.inscrito
   │   ├── calificacion.final.asignada
   │   ├── asistencia.resumen.calculado
   │   ├── inscripcion.rechazada
   │   └── materia.carga.llena
   │
   └── setupDLQListener()
       └── Escuchar DLQ

2. Para cada mensaje en DLQ:
   └── onDeadLetterReceived()
       ├── Logear error detallado
       ├── Registrar en base de datos (futuro)
       ├── Alertar administrador (futuro)
       └── Guardar para reprocessing manual
```

#### Logs Generados:

```
💀 DEAD LETTER RECIBIDO: alumno.inscrito
{
  failureReason: "ECONNREFUSED",
  failedAt: "2024-05-24T10:35:00Z",
  retriesExhausted: true
}

⚠️ Evento enviado a DLQ para recuperación manual
```

---

### 4. ✅ Metadata de Reintentos

**Agregada a cada evento:**

```typescript
// Auto-agregado por publishEventWithRetry()
interface RabbitMQEventPayload {
  _retryCount?: number; // Número actual de intento
  _firstAttempt?: string; // Timestamp del primer intento (ISO)
  // ... otros campos del evento
}
```

**Headers HTTP de RabbitMQ:**

```typescript
headers: {
  'x-retry-count': 0,  // 0, 1, 2, 3
  'x-first-attempt': '2024-05-24T10:30:00Z'
}
```

**Uso en monitoreo:**

- Calcular tiempo total de reintentos
- Rastrear patrón de fallos
- Identificar servicios problemáticos

---

## 📊 Escenarios de Uso

### Escenario 1: Fallo Transitorio (RabbitMQ Reinicia)

```
Tiempo    Acción                           Estado
0s        Intento 1                        ✅ Éxito
          (RabbitMQ se reinicia)
2s        Falla detectable                 ❌ Error
          Reintentará en 5 segundos
7s        Intento 2                        ✅ Éxito!
          (RabbitMQ ya está up)
```

**Resultado:** Mensaje entregado exitosamente después de reintento automático.

---

### Escenario 2: Fallo Persistente (Servicio Consumidor Down)

```
Tiempo    Acción                           Reintentos
0s        Intento 1                        Intento 1/3
          RabbitMQ recibe OK ✅
5s        Intento 2 (backoff = 5s)         Intento 2/3
          RabbitMQ recibe OK ✅
15s       Intento 3 (backoff = 10s)        Intento 3/3
          RabbitMQ recibe OK ✅
35s       Intento 4 (backoff = 20s)        ❌ MAX REACHED
          → ENVIAR A DLQ 💀
```

**Resultado:** Mensaje en DLQ después de 35 segundos para análisis manual.

---

### Escenario 3: Fallo de Red (Pérdida Temporal de Conexión)

```
RED STATUS:    DOWN (10-20s)
0s       Intento 1              ❌ Connection refused
         Espera 5s...
5s       Intento 2              ❌ Connection refused
         Espera 10s...
15s      ✅ RED VUELVE
20s      Intento 3              ✅ Éxito!
```

**Resultado:** Recuperación automática sin intervención manual.

---

## 🔧 Configuración

### Valores por Defecto

**`shared/rabbitmq.constants.ts`:**

```typescript
export const RABBITMQ_RETRY_CONFIG = {
  MAX_RETRIES: 3, // 3 reintentos
  RETRY_DELAY_MS: 5000, // 5000 ms = 5 segundos
  DLQ_MESSAGE_TTL_MS: 86400000, // 86400000 ms = 24 horas
};
```

### Personalización

```typescript
// En app.controller.ts - Para casos específicos

// Crítico: Más reintentos
await this.rabbitmqService.publishEventWithRetry(
  "calificacion.final.asignada",
  evento,
  { maxRetries: 5, retryDelayMs: 3000 },
);

// No crítico: Menos reintentos
await this.rabbitmqService.publishEventWithRetry(
  "notificacion.enviada",
  evento,
  { maxRetries: 1, retryDelayMs: 1000 },
);

// Ultra agresivo: Sin backoff
await this.rabbitmqService.publishEventWithRetry("evento.tiempo.real", evento, {
  maxRetries: 2,
  retryDelayMs: 100,
  exponentialBackoff: false,
});
```

---

## 📈 Monitoreo

### Logs en Tiempo Real

```bash
# Terminal 1: Ver publicaciones
docker logs agm_ms_alumnos -f | grep "Evento publicado"

# Terminal 2: Ver reintentos
docker logs agm_ms_alumnos -f | grep "Reintentando"

# Terminal 3: Ver errores a DLQ
docker logs agm_ms_notificaciones -f | grep "DEAD LETTER"
```

### RabbitMQ Management UI

**URL:** `http://localhost:15672`

- Usuario: `agm_user`
- Contraseña: `agm_password`

**Secciones a monitorear:**

1. **Queues**
   - `notificaciones.queue` - Mensajes normales
   - `dlq.default` - Mensajes fallidos

2. **Ready** (listos para consumir)
   - Indica cuántos mensajes esperan
   - Normal: 0-5 (depende de velocidad)
   - Alerta: > 100 (posible bottleneck)

3. **Unacked** (no confirmados)
   - Normal: 0
   - Alerta: > 0 por más de 5 minutos

---

## 🛡️ Flujo Completo de Recuperación

```typescript
// 1. PUBLICAR (ms-alumnos)
const evento: AlumnoInscritoEvent = {
  alumno_id: 123,
  matricula: "A001",
  // ...
};

// 2. REINTENTOS AUTOMÁTICOS
await this.rabbitmqService.publishEvent("alumno.inscrito", evento);
// Si falla 3 veces en 35 segundos → IR A PASO 3

// 3. DEAD LETTER QUEUE
// Mensaje guardado en dlq.default
// Con metadata: failureReason, timestamp, etc.

// 4. DLQ LISTENER (ms-notificaciones)
// Escucha dlq.default
// Logea error detallado
// Alertaría administrador (futuro)

// 5. RECUPERACIÓN MANUAL (futuro)
// Administrador revisa en Management UI
// Valida el payload
// Republica a la queue normal
// Prosigue procesamiento
```

---

## ✅ Checklist de Implementación

- [x] Retry logic con exponential backoff en `RabbitMQService`
- [x] Dead Letter Exchange (DLX) configurado
- [x] Dead Letter Queue (DLQ) en constants
- [x] DLQ Listener en ms-notificaciones
- [x] Headers de metadata en mensajes
- [x] Logging detallado de reintentos
- [x] Copiar service a todos los microservicios
- [x] Documentación Part 9

---

## 🚀 Pruebas (Con Docker)

### Test 1: Reintentos Exitosos

```bash
# 1. Levanta servicios
docker compose up -d

# 2. Inspecciona logs
docker logs agm_ms_alumnos -f

# 3. Mata RabbitMQ por 10 segundos
docker stop rabbitmq
sleep 10
docker start rabbitmq

# 4. Observa reintentos automáticos en logs
# Debe decir: "⚠️ Error publicando ... Reintentando..."
# Luego: "📤 Evento publicado (Reintento 2/3)"
```

### Test 2: Dead Letter Queue

```bash
# 1. Mata ms-notificaciones permanentemente
docker stop agm_ms_notificaciones

# 2. Publica un evento
curl -X POST http://localhost:3002/alumnos/inscribir \
  -H "Content-Type: application/json" \
  -d '{"matricula_alumno": "A001", "nrc_materia": "10001"}'

# 3. Espera 40 segundos (3 reintentos + backoff)

# 4. Verifica DLQ en Management UI
# http://localhost:15672 → Queues → dlq.default
# Debe tener 1 mensaje

# 5. Revisa logs de notificaciones
docker logs agm_ms_notificaciones | grep "DEAD LETTER"
```

### Test 3: Recuperación de DLQ

```bash
# 1. Mensaje en DLQ (del test anterior)

# 2. Reinicia ms-notificaciones
docker start agm_ms_notificaciones

# 3. El DLQ listener verá el mensaje
docker logs agm_ms_notificaciones -f | grep "DEAD LETTER"

# 4. Administrador puede republish manualmente
# (Futuro: Implementar endpoint GET /dlq para ver mensajes)
```

---

## 📝 Próximos Pasos (Part 10+)

### Part 10: Eventos Complejos

- Cascada de eventos (desinscripción → liberar capacidad)
- Validaciones multi-servicio

### Part 11: Recuperación Automática de DLQ

- Endpoint para consultar mensajes en DLQ
- Endpoint para republish automático
- Base de datos para auditoría de fallos

### Part 12: Metricas y Alertas

- Prometheus metrics para reintentos
- Alertas si DLQ supera N mensajes
- Dashboard de salud RabbitMQ

---

## 📚 Referencias

- [RabbitMQ Dead Letter Exchanges](https://www.rabbitmq.com/dlx.html)
- [Exponential Backoff](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [NestJS RabbitMQ Guide](https://docs.nestjs.com/microservices/rabbitmq)
- [amqplib Documentation](https://www.npmjs.com/package/amqplib)

---

## 🎓 Conclusión

La Parte 9 implementa un sistema robusto de recuperación de errores que:

✅ **Recupera fallos transitorios automáticamente**
✅ **Evita sobrecargas con exponential backoff**
✅ **Almacena mensajes irrecuperables en DLQ**
✅ **Proporciona logging detallado para debugging**
✅ **Escala a todos los microservicios**

El sistema está ahora **resiliente y listo para producción** con manejo de errores de clase empresarial.
