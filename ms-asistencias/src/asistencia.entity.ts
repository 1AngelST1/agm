import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('asistencias')
export class Asistencia {
  @PrimaryColumn()
  id!: string;

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

  @CreateDateColumn()
  fecha_registro!: Date;
}
