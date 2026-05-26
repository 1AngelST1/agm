/**
 * 📨 AGM Events - Tipos y definiciones para RabbitMQ
 * Este archivo define todos los eventos que se comunican entre microservicios
 */

// ============================================
// 1️⃣ EVENTOS DE AUTENTICACIÓN (ms-auth)
// ============================================

export interface AuthUsuarioCreadoEvent {
  user_id: string;
  email: string;
  nombre: string;
  role: 'admin' | 'docente' | 'alumno';
  fecha_creacion: Date;
}

export interface AuthRolActualizadoEvent {
  user_id: string;
  rol_anterior: string;
  rol_nuevo: string;
  timestamp: Date;
}

// ============================================
// 2️⃣ EVENTOS DE ALUMNOS (ms-alumnos) - CRÍTICOS
// ============================================

export interface AlumnoInscritoEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  periodo: string;
  fecha_inscripcion: Date;
  docente_id?: string;
}

export interface AlumnoDesinscritoEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  motivo: string;
  fecha_desinscripcion: Date;
}

export interface AlumnoDatosActualizadosEvent {
  alumno_id: string;
  matricula: string;
  campos_cambiados: string[];
  nuevos_valores: Record<string, any>;
}

// ============================================
// 3️⃣ EVENTOS DE ASISTENCIAS (ms-asistencias) - CRÍTICOS
// ============================================

export interface AsistenciaRegistradaEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  timestamp: Date;
  qr_token: string;
  estado: 'presente' | 'ausente';
}

export interface AsistenciaCorregidaEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  estado_anterior: string;
  estado_nuevo: string;
  motivo: string;
  corregido_por: string;
  fecha_correccion: Date;
}

export interface AsistenciaResumenCalculadoEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  total_clases: number;
  asistencias: number;
  faltas: number;
  porcentaje_asistencia: number;
  derecho_proyecto: boolean; // true si >= 80%, false si < 80%
  fecha_calculo: Date;
}

export interface QRGeneradoEvent {
  nrc_materia: string;
  fecha: Date;
  token: string;
  expira_en_segundos: number;
}

// ============================================
// 4️⃣ EVENTOS DE CALIFICACIONES (ms-calificaciones) - CRÍTICOS
// ============================================

export interface CalificacionCreadaEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  tipo: 'parcial' | 'examen' | 'tarea' | 'proyecto';
  calificacion: number;
  fecha: Date;
  creado_por: string;
}

export interface CalificacionActualizadaEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  tipo: string;
  calificacion_anterior: number;
  calificacion_nueva: number;
  motivo: string;
  actualizado_por: string;
  fecha_actualizacion: Date;
}

export interface CalificacionFinalAsignadaEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  calificacion_final: number;
  derecho_proyecto: boolean;
  estatus: 'aprobado' | 'reprobado' | 'condicional';
  fecha_asignacion: Date;
  asignado_por: string;
}

export interface AlumnoSinDerechoProyectoEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  motivo: 'asistencia_baja' | 'calificacion_baja' | 'otro';
  porcentaje_asistencia?: number;
  calificacion_promedio?: number;
  fecha_evento: Date;
}

// ============================================
// 5️⃣ EVENTOS DE PERÍODOS (ms-periodos)
// ============================================

export interface PeriodoIniciadoEvent {
  periodo_id: string;
  nombre: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  estado: 'activo' | 'en_preparacion' | 'finalizado';
}

export interface PeriodoFinalizadoEvent {
  periodo_id: string;
  nombre: string;
  fecha_cierre: Date;
}

export interface GrupoCreatedEvent {
  nrc: string;
  materia_id: string;
  materia_nombre: string;
  docente_id: string;
  periodo: string;
  seccion: string;
  capacidad: number;
}

// ============================================
// 6️⃣ EVENTOS DE NOTIFICACIONES (ms-notificaciones)
// ============================================

export interface NotificacionEnviadaEvent {
  notificacion_id: string;
  destinatario: string;
  tipo: string;
  timestamp: Date;
}

export interface NotificacionFallidaEvent {
  notificacion_id: string;
  destinatario: string;
  motivo_fallo: string;
  reintento_num: number;
  timestamp: Date;
}

// ============================================
// 7️⃣ EVENTOS DE REPORTES (ms-reportes)
// ============================================

export interface ReporteGeneradoEvent {
  reporte_id: string;
  tipo: 'concentrado' | 'asistencia' | 'calificaciones' | 'general';
  periodo: string;
  fecha_generacion: Date;
  url_descarga: string;
  generado_por: string;
}

export interface ReporteFallaEvent {
  reporte_id: string;
  tipo: string;
  motivo: string;
  timestamp: Date;
}

// ============================================
// 8️⃣ EVENTOS DE VALIDACIÓN / ERRORES
// ============================================

export interface InscripcionRechazadaEvent {
  alumno_id: string;
  matricula: string;
  nrc_materia: string;
  motivo: 'carga_excedida' | 'grupo_lleno' | 'ya_inscrito' | 'prerequisito' | 'otro';
  detalle: string;
  fecha_rechazo: Date;
}

export interface MateriaCargaLlenaEvent {
  nrc_materia: string;
  grupo_id: string;
  capacidad_maxima: number;
  inscritos_actuales: number;
  timestamp: Date;
}

// ============================================
// UNION TYPES - Para type checking
// ============================================

export type AnyEvent =
  | AuthUsuarioCreadoEvent
  | AuthRolActualizadoEvent
  | AlumnoInscritoEvent
  | AlumnoDesinscritoEvent
  | AlumnoDatosActualizadosEvent
  | AsistenciaRegistradaEvent
  | AsistenciaCorregidaEvent
  | AsistenciaResumenCalculadoEvent
  | QRGeneradoEvent
  | CalificacionCreadaEvent
  | CalificacionActualizadaEvent
  | CalificacionFinalAsignadaEvent
  | AlumnoSinDerechoProyectoEvent
  | PeriodoIniciadoEvent
  | PeriodoFinalizadoEvent
  | GrupoCreatedEvent
  | NotificacionEnviadaEvent
  | NotificacionFallidaEvent
  | ReporteGeneradoEvent
  | ReporteFallaEvent
  | InscripcionRechazadaEvent
  | MateriaCargaLlenaEvent;
