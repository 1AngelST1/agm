// ==========================================
// MATERIAS
// ==========================================

export class CreateMateriaDto {
  clave!: string; // Ej. 'ITIS260'
  nombre!: string; // Ej. 'Servicios Web'
  creditos!: number; // Ej. 4
  horas_teoricas!: number;
  horas_practicas!: number;
}

// ==========================================
// GRUPOS
// ==========================================

export class CreateGrupoDto {
  nrc!: string; // Ej. '50130'
  materia_clave!: string; // FK a Materia
  seccion!: string; // Ej. '001'
  periodo!: string; // Ej. 'Primavera 2026'
  docente_id?: string; // Opcional: si es admin, puede especificar el docente
}

// ==========================================
// CALIFICACIONES
// ==========================================

export class CreateCalificacionDto {
  nrc_grupo!: string; // FK a Grupo
  matricula_alumno!: string; // FK a Alumno
  calificacion_ordinaria!: number; // Ej. 8.5
  tipo_calificacion?: 'examen' | 'tarea' | 'proyecto';
  actividad_id?: string; // FK opcional a Actividad
}

export class UpdateCalificacionDto {
  calificacion_ordinaria!: number;
  tipo_calificacion?: 'examen' | 'tarea' | 'proyecto';
}

// ==========================================
// PONDERACIONES
// ==========================================

export class CreatePonderacionDto {
  materia_clave!: string; // FK a Materia
  examen_porcentaje!: number; // Ej. 40
  tarea_porcentaje!: number; // Ej. 30
  proyecto_porcentaje!: number; // Ej. 30
}

export class UpdatePonderacionDto {
  examen_porcentaje?: number;
  tarea_porcentaje?: number;
  proyecto_porcentaje?: number;
}

// ==========================================
// ACTIVIDADES
// ==========================================

export class CreateActividadDto {
  nrc_grupo!: string; // FK a Grupo
  nombre!: string; // Ej. 'Examen Parcial 1'
  tipo!: 'examen' | 'tarea' | 'proyecto';
  descripcion?: string;
  valor_maximo?: number; // Ej. 100 puntos
}

export class UpdateActividadDto {
  nombre?: string;
  tipo?: 'examen' | 'tarea' | 'proyecto';
  descripcion?: string;
  valor_maximo?: number;
  activo?: boolean;
}

// ==========================================
// CONCENTRADO (Reporte)
// ==========================================

export class ConcentradoResponse {
  nrc_grupo!: string;
  materia!: {
    clave: string;
    nombre: string;
  };
  periodo!: string;
  total_estudiantes!: number;
  calificaciones!: {
    matricula: string;
    nombre_estudiante: string;
    calificacion_examen: number;
    calificacion_tarea: number;
    calificacion_proyecto: number;
    promedio_ponderado: number;
    estatus: string;
  }[];
  ponderaciones!: {
    examen: number;
    tarea: number;
    proyecto: number;
  };
}

// Validar que los porcentajes sumen 100%
export function validatePonderacionSum(ponderacion: CreatePonderacionDto | UpdatePonderacionDto): boolean {
  const examen = (ponderacion as any).examen_porcentaje || 0;
  const tarea = (ponderacion as any).tarea_porcentaje || 0;
  const proyecto = (ponderacion as any).proyecto_porcentaje || 0;
  
  const total = examen + tarea + proyecto;
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Los porcentajes deben sumar 100%, actual: ${total}`);
  }
  return true;
}
