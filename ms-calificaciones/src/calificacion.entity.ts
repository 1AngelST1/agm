import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Grupo } from './grupo.entity';

@Entity('calificaciones')
export class Calificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo: Grupo;

  @Column()
  matricula_alumno: string; // Ej. '202253882' (Tu matrícula)

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  calificacion_ordinaria: number; // Ej. 8.50

  @Column({ default: 'Cursando' })
  estatus: string; // Cursando, Aprobado, Reprobado
}
