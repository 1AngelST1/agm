import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Grupo } from './grupo.entity';

@Entity('calificaciones')
export class Calificacion {
  @PrimaryColumn()
  matricula_alumno!: string; // Ej. '202253882' (Llave primaria 1)

  @PrimaryColumn()
  nrc_grupo!: string; // Ej. '50130' (Llave primaria 2)

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo!: Grupo;

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  calificacion_ordinaria!: number; // Ej. 8.50

  @Column({ default: 'Cursando' })
  estatus!: string; // Cursando, Aprobado, Reprobado
  // ✨ Un alumno solo puede tener UNA calificación por grupo (PK compuesta)
}
