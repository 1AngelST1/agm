import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { Materia } from './materia.entity';

@Entity('ponderaciones')
export class Ponderacion {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => Materia)
  @JoinColumn({ name: 'materia_clave' })
  materia!: Materia;

  @Column()
  materia_clave!: string; // FK a Materia

  @Column('decimal', { precision: 5, scale: 2, default: 40 })
  examen_porcentaje!: number; // Ej. 40

  @Column('decimal', { precision: 5, scale: 2, default: 30 })
  tarea_porcentaje!: number; // Ej. 30

  @Column('decimal', { precision: 5, scale: 2, default: 30 })
  proyecto_porcentaje!: number; // Ej. 30

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      const random = Math.random().toString(36).substring(2, 10);
      this.id = `pon_${random}`;
    }
  }
}
