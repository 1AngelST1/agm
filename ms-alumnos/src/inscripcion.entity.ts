import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('inscripciones')
export class Inscripcion {
  @PrimaryColumn() // Quitamos el 'uuid' y lo dejamos como columna primaria normal
  id!: string;

  @Column()
  matricula_alumno!: string;

  @Column()
  nrc_materia!: string;

  @CreateDateColumn()
  fecha_inscripcion!: Date;
}
