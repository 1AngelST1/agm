import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Grupo } from './grupo.entity';

@Entity('calificaciones_finales')
export class CalificacionFinal {
  @PrimaryColumn()
  id!: string; // Ej. 'cal_fin_xxxx'

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo!: Grupo;

  @Column()
  nrc_grupo!: string; // FK a Grupo (NRC)

  @Column()
  matricula_alumno!: string; // FK a Alumno (matrícula)

  @Column('decimal', { precision: 5, scale: 2 })
  calificacion_examen!: number; // Promedio de todos los exámenes

  @Column('decimal', { precision: 5, scale: 2 })
  calificacion_tarea!: number; // Promedio de todas las tareas

  @Column('decimal', { precision: 5, scale: 2 })
  calificacion_proyecto!: number; // Promedio de todos los proyectos

  @Column('decimal', { precision: 5, scale: 2 })
  promedio_ponderado!: number; // (examen * 40% + tarea * 30% + proyecto * 30%)

  @Column()
  estatus!: 'Aprobado' | 'Reprobado'; // Automático basado en promedio >= 6

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ nullable: true })
  calculado_por!: string; // user_id del admin/docente que calculó

  @Column({ type: 'timestamp', nullable: true })
  fecha_calculo!: Date;
}
