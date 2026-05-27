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
  matricula_alumno!: string;

  @PrimaryColumn()
  nrc_grupo!: string;

  @Column({ nullable: true })
  nrc_materia?: string;

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo!: Grupo;

  @Column({ nullable: true })
  actividad_id?: string;

  @ManyToOne(() => Actividad, { nullable: true })
  @JoinColumn({ name: 'actividad_id' })
  actividad?: Actividad;

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  calificacion_ordinaria!: number;

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  calificacion_final?: number;

  @Column({ nullable: true })
  tipo_calificacion?: 'examen' | 'tarea' | 'proyecto';

  @Column({ default: 'Cursando' })
  estatus!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}