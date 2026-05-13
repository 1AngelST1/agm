import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Periodo } from './periodo.entity';

@Entity('materias')
export class Materia {
  @PrimaryColumn()
  nrc: string = ''; // El NRC es la llave primaria única por periodo

  @Column()
  clave: string = ''; // Ej: ITIS 260

  @Column()
  nombre: string = '';

  @Column()
  seccion: string = '';

  @Column({ nullable: true })
  horario: string = '';

  @Column({ nullable: true })
  docente_asignado: string = '';

  @Column()
  periodo_id: string = '';

  @ManyToOne(() => Periodo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'periodo_id' })
  periodo: Periodo;

  @CreateDateColumn()
  creado_en: Date = new Date();

  @UpdateDateColumn()
  actualizado_en: Date = new Date();
}
