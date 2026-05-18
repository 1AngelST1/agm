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
import { Actividad } from './actividad.entity';

@Entity('calificaciones')
export class Calificacion {
  @PrimaryColumn()
  matricula_alumno!: string; // Ej. '202253882' (Llave primaria 1)

  @PrimaryColumn()
  nrc_grupo!: string; // Ej. '50130' (Llave primaria 2)

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo!: Grupo;

  @Column({ nullable: true })
  actividad_id?: string; // FK opcional a Actividad (para calificaciones por actividad)

  @ManyToOne(() => Actividad, { nullable: true })
  @JoinColumn({ name: 'actividad_id' })
  actividad?: Actividad;

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  calificacion_ordinaria!: number; // Ej. 8.50

  @Column({ nullable: true })
  tipo_calificacion?: 'examen' | 'tarea' | 'proyecto'; // Para categorizar

  @Column({ default: 'Cursando' })
  estatus!: string; // Cursando, Aprobado, Reprobado

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // ✨ Un alumno solo puede tener UNA calificación por grupo (PK compuesta)
  // Ahora soporta múltiples calificaciones si tienen diferentes actividades
}
