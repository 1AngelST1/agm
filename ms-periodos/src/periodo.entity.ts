import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('periodos')
export class Periodo {
  @PrimaryColumn()
  id: string = '';

  @Column({ unique: true })
  nombre: string = '';

  @Column({ type: 'date' })
  fecha_inicio: string = '';

  @Column({ type: 'date' })
  fecha_fin: string = '';

  @Column()
  plan_estudios: string = '';

  @Column({ default: false })
  activo: boolean = false;

  @CreateDateColumn()
  creado_en: Date = new Date();

  @UpdateDateColumn()
  actualizado_en: Date = new Date();

  @BeforeInsert()
  generateId() {
    // Genera un ID con prefijo PER- para diferenciarlo de alumnos o materias
    // Formato: PER-XXXXXXXX (8 caracteres aleatorios en mayúsculas)
    const shortId = uuidv4().split('-')[0].toUpperCase();
    this.id = `PER-${shortId}`;
  }
}
