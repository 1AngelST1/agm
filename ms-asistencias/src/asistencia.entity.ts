import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SesionAsistencia } from './sesion-asistencia.entity';

@Entity('asistencias')
export class Asistencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sesion_id!: string;  // FK a SesionAsistencia

  @Column()
  matricula_alumno!: string;

  @Column()
  nrc_materia!: string;

  @Column({
    type: 'enum',
    enum: ['presente', 'retardo', 'falta'],
    default: 'presente',
  })
  estado!: string;

  @Column({ default: false })
  qr_validado!: boolean;

  @CreateDateColumn()
  fecha_registro!: Date;
}

