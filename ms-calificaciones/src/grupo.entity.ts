import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Materia } from './materia.entity';

@Entity('grupos')
export class Grupo {
  @PrimaryColumn()
  nrc!: string; // Ej. '50130'

  @ManyToOne(() => Materia)
  @JoinColumn({ name: 'materia_clave' })
  materia!: Materia;

  @Column({ nullable: true })
  docente_id?: string; // Ej. 'usr_abc123' (El ID del profesor en ms-auth) - nullable para testing

  @Column()
  seccion!: string; // Ej. '001'

  @Column()
  periodo!: string; // Ej. 'Primavera 2026'
}
