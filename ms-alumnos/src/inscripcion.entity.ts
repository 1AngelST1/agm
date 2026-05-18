import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('inscripciones')
export class Inscripcion {
  @PrimaryColumn()
  id!: string;

  @Column()
  matricula_alumno!: string;

  @Column()
  nrc_materia!: string;

  // 🔥 AQUÍ ESTÁ EL CAMPO QUE LE FALTABA A TYPESCRIPT
  @Column({
    type: 'varchar',
    length: 20,
    default: 'activo',
  })
  estatus!: string;

  @CreateDateColumn()
  fecha_inscripcion!: Date;
}
