import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Grupo } from './grupo.entity';

@Entity('calificaciones')
export class Calificacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  codigo!: string; // Ej. 'cal_a1b2c3d4'

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo!: Grupo;

  @Column()
  matricula_alumno!: string; // Ej. '202253882' (Tu matrícula)

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  calificacion_ordinaria!: number; // Ej. 8.50

  @Column({ default: 'Cursando' })
  estatus!: string; // Cursando, Aprobado, Reprobado

  // 🏷️ Generar código con prefijo antes de guardar
  @BeforeInsert()
  generarCodigo() {
    if (!this.codigo) {
      // Generar hash corto de 8 caracteres del UUID
      const shortHash = this.id.substring(0, 8);
      this.codigo = `cal_${shortHash}`;
    }
  }
}
