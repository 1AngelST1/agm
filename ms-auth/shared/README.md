# 📨 AGM Shared - Tipos y Configuración de RabbitMQ

Este directorio contiene las definiciones compartidas que todos los microservicios usan para comunicarse a través de RabbitMQ.

## Archivos

### `events.types.ts`

Define **tipos TypeScript para cada evento** que se publica en RabbitMQ.

**Estructura:**

- ✅ `AuthUsuarioCreadoEvent` - Cuando se registra un usuario
- ✅ `AlumnoInscritoEvent` - Cuando un alumno se inscribe a una materia
- ✅ `AsistenciaRegistradaEvent` - Cuando se escanea un QR
- ✅ `AsistenciaResumenCalculadoEvent` - Cuando se calcula el % de asistencia
- ✅ `CalificacionFinalAsignadaEvent` - Cuando se asigna nota final
- ✅ `AlumnoSinDerechoProyectoEvent` - Cuando no cumple regla de 80%

### `rabbitmq.constants.ts`

Define **configuración y rutas** de RabbitMQ.

**Includes:**

- 🔹 `RABBITMQ_EXCHANGE` - El nombre del exchange (agm.events)
- 🔹 `RABBITMQ_QUEUES` - Nombres de todas las colas
- 🔹 `RABBITMQ_ROUTING_KEYS` - Patrones de enrutamiento (ej: "alumno.inscrito")
- 🔹 `RABBITMQ_BINDINGS` - Qué servicio escucha qué eventos
- 🔹 `RABBITMQ_CONFIG` - URL y opciones de conexión

## Cómo Usar en un Microservicio

### 1. Importar los tipos

```typescript
import { AlumnoInscritoEvent } from "@shared/events.types";
import { RABBITMQ_ROUTING_KEYS } from "@shared/rabbitmq.constants";
```

### 2. Publicar un evento (en ms-alumnos)

```typescript
import { ClientProxy } from "@nestjs/microservices";

export class AlumnosService {
  constructor(
    @Inject("RABBITMQ_SERVICE") private rabbitmqClient: ClientProxy,
  ) {}

  async inscribirAlumno(data) {
    // Guardar en BD...

    // Publicar evento
    this.rabbitmqClient.emit(RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO, {
      alumno_id: data.alumno_id,
      matricula: data.matricula,
      nrc_materia: data.nrc_materia,
      // ...
    } as AlumnoInscritoEvent);
  }
}
```

### 3. Escuchar un evento (en ms-calificaciones)

```typescript
import { EventPattern } from "@nestjs/microservices";
import { AlumnoInscritoEvent } from "@shared/events.types";
import { RABBITMQ_ROUTING_KEYS } from "@shared/rabbitmq.constants";

export class CalificacionesService {
  @EventPattern(RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO)
  async alOnInscrito(data: AlumnoInscritoEvent) {
    console.log(`📚 Alumno inscrito: ${data.matricula}`);
    // Crear registro de calificación...
  }
}
```

## Eventos Críticos (Implementar Primero)

| Prioridad  | Evento                         | Origen            | Consumidores                      |
| ---------- | ------------------------------ | ----------------- | --------------------------------- |
| 🔴 CRÍTICA | `alumno.inscrito`              | ms-alumnos        | ms-asistencias, ms-calificaciones |
| 🔴 CRÍTICA | `asistencia.resumen.calculado` | ms-asistencias    | ms-calificaciones                 |
| 🔴 CRÍTICA | `calificacion.final.asignada`  | ms-calificaciones | ms-notificaciones, ms-periodos    |
| 🔴 CRÍTICA | `alumno.sin.derecho.proyecto`  | ms-calificaciones | ms-notificaciones, ms-periodos    |

## Estructura de RabbitMQ

```
Exchange: agm.events (Type: TOPIC)
│
├─ Routing Key: alumno.inscrito
│  └─ Bound to: asistencias.queue, calificaciones.queue
│
├─ Routing Key: asistencia.resumen.calculado
│  └─ Bound to: calificaciones.queue
│
└─ Routing Key: calificacion.final.asignada
   └─ Bound to: notificaciones.queue, periodos.queue
```

## Variables de Entorno

En `docker-compose.yml`:

```yaml
RABBITMQ_URL: amqp://agm_user:agm_password@rabbitmq:5672/agm
```

En desarrollo local:

```bash
export RABBITMQ_URL=amqp://agm_user:agm_password@localhost:5672/agm
```

## Management UI de RabbitMQ

Accede a: `http://localhost:15672`

- Usuario: `guest`
- Contraseña: `guest`

(O usa las credenciales: `agm_user` / `agm_password`)

## Notas Importantes

- ✅ Todos los eventos son **asíncronos** (no esperan respuesta)
- ✅ Los mensajes se **persisten en la cola** si el consumidor no está disponible
- ✅ Si algo falla 3 veces, va a **Dead Letter Queue (DLQ)**
- ✅ Usar `as EventType` para type safety en TypeScript
