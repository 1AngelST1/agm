/**
 * 📨 AGM RabbitMQ Configuration - Constantes y configuración
 */

// ============================================
// EXCHANGE PRINCIPAL
// ============================================
export const RABBITMQ_EXCHANGE = 'agm.events';
export const RABBITMQ_EXCHANGE_TYPE = 'topic'; // Permite patrones tipo: alumno.*

// ============================================
// VIRTUAL HOST
// ============================================
export const RABBITMQ_VHOST = '/agm';

// ============================================
// COLAS PRINCIPALES (QUEUES)
// ============================================

export const RABBITMQ_QUEUES = {
  // Servicios que publican/consumen eventos
  ASISTENCIAS: 'asistencias.queue',
  CALIFICACIONES: 'calificaciones.queue',
  NOTIFICACIONES: 'notificaciones.queue',
  REPORTES: 'reportes.queue',
  ALUMNOS: 'alumnos.queue',
  PERIODOS: 'periodos.queue',

  // Auditoría y Dead Letter
  AUDITOR: 'auditor.queue',
  DEAD_LETTER: 'dlq.default',
} as const;

// ============================================
// ROUTING KEYS (PATRONES DE EVENTOS)
// ============================================

export const RABBITMQ_ROUTING_KEYS = {
  // AUTH
  AUTH_USUARIO_CREADO: 'auth.usuario.creado',
  AUTH_ROL_ACTUALIZADO: 'auth.rol.actualizado',
  AUTH_CONTRASENA_CAMBIADA: 'auth.contrasena.cambiada',

  // ALUMNOS
  ALUMNO_INSCRITO: 'alumno.inscrito',
  ALUMNO_DESINSCRITO: 'alumno.desinscrito',
  ALUMNO_DATOS_ACTUALIZADOS: 'alumno.datos.actualizados',
  ALUMNO_BAJA_SOLICITADA: 'alumno.baja.solicitada',

  // ASISTENCIAS
  ASISTENCIA_REGISTRADA: 'asistencia.registrada',
  ASISTENCIA_CORREGIDA: 'asistencia.corregida',
  ASISTENCIA_RESUMEN_CALCULADO: 'asistencia.resumen.calculado',
  QR_GENERADO: 'qr.generado',

  // CALIFICACIONES
  CALIFICACION_CREADA: 'calificacion.creada',
  CALIFICACION_ACTUALIZADA: 'calificacion.actualizada',
  CALIFICACION_FINAL_ASIGNADA: 'calificacion.final.asignada',
  ALUMNO_SIN_DERECHO_PROYECTO: 'alumno.sin.derecho.proyecto',

  // PERIODOS
  PERIODO_INICIADO: 'periodo.iniciado',
  PERIODO_FINALIZADO: 'periodo.finalizado',
  GRUPO_CREADO: 'grupo.creado',

  // NOTIFICACIONES (no publica, solo consume)
  NOTIFICACION_ENVIADA: 'notificacion.enviada',
  NOTIFICACION_FALLIDA: 'notificacion.fallida',

  // REPORTES
  REPORTE_GENERADO: 'reporte.generado',
  REPORTE_FALLA: 'reporte.falla',

  // VALIDACIONES / ERRORES
  INSCRIPCION_RECHAZADA: 'inscripcion.rechazada',
  MATERIA_CARGA_LLENA: 'materia.carga.llena',
} as const;

// ============================================
// BINDINGS - Qué queue escucha qué eventos
// ============================================

export const RABBITMQ_BINDINGS = {
  asistencias: [
    'alumno.inscrito',
    'alumno.desinscrito',
    'periodo.iniciado',
  ],

  calificaciones: [
    'alumno.inscrito',
    'asistencia.resumen.calculado', // CRÍTICO: para aplicar regla 80%
    'calificacion.creada',
    'calificacion.actualizada',
  ],

  notificaciones: [
    'auth.usuario.creado',
    'auth.rol.actualizado',
    'alumno.inscrito',
    'alumno.desinscrito',
    'alumno.baja.solicitada',
    'asistencia.corregida',
    'calificacion.creada',
    'calificacion.actualizada',
    'calificacion.final.asignada',
    'alumno.sin.derecho.proyecto',
    'reporte.generado',
  ],

  reportes: [
    'alumno.inscrito',
    'asistencia.registrada',
    'calificacion.creada',
    'calificacion.actualizada',
    'calificacion.final.asignada',
    'periodo.finalizado',
  ],

  periodos: [
    'alumno.inscrito',
    'calificacion.final.asignada',
    'grupo.creado',
  ],

  auditor: [
    '#', // Recibe TODOS los eventos (wildcard)
  ],
} as const;

// ============================================
// CONFIGURACIÓN DE CONEXIÓN
// ============================================

export const RABBITMQ_CONFIG = {
  // URL de conexión
  // En desarrollo: amqp://agm_user:agm_password@localhost:5672/agm
  // En Docker: amqp://agm_user:agm_password@rabbitmq:5672/agm
  url:
    process.env.RABBITMQ_URL ||
    'amqp://agm_user:agm_password@rabbitmq:5672/agm',

  // Opciones de reconexión
  reconnectTimeInSeconds: 5,

  // Opciones de cola
  queue: {
    durable: true,
    noAck: false, // Require ACK (confirmación manual)
    prefetch: 1,
  },

  // Opciones de exchange
  exchange: {
    durable: true,
    type: 'topic',
  },

  // Dead Letter Exchange (para mensajes fallidos)
  deadLetterExchange: 'agm.events.dlx',
} as const;

// ============================================
// CONSTANTES PARA REINTENTOS
// ============================================

export const RABBITMQ_RETRY_CONFIG = {
  // Número máximo de reintentos antes de enviar a DLQ
  MAX_RETRIES: 3,

  // Delay entre reintentos (milisegundos)
  RETRY_DELAY_MS: 5000,

  // TTL para mensajes en DLQ (24 horas)
  DLQ_MESSAGE_TTL_MS: 24 * 60 * 60 * 1000,
} as const;

// ============================================
// TIPOS DE PATRÓN
// ============================================

export enum EventPattern {
  // PUB/SUB
  ASISTENCIA_REGISTRADA = 'asistencia.registrada',
  CALIFICACION_CREADA = 'calificacion.creada',
  ALUMNO_INSCRITO = 'alumno.inscrito',

  // WORK QUEUE (procesos pesados)
  REPORTE_GENERACION = 'reporte.generacion',
  CALCULO_PROMEDIOS = 'calculo.promedios',

  // EVENT SOURCING (auditoría)
  EVENTO_AUDITADO = 'evento.*',
}
