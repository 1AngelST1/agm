import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Unique,
} from 'typeorm';
import { Grupo } from './grupo.entity';

@Entity('actividades')
@Unique(['nrc_grupo', 'nombre', 'tipo'])
export class Actividad {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => Grupo)
  @JoinColumn({ name: 'nrc_grupo' })
  grupo!: Grupo;

  @Column()
  nrc_grupo!: string; // FK a Grupo (NRC)

  @Column()
  nombre!: string; // Ej. 'Examen Parcial 1', 'Tarea 1', 'Proyecto Final'

  @Column()
  tipo!: 'examen' | 'tarea' | 'proyecto'; // Categoría para aplicar ponderación

  @Column({ nullable: true })
  descripcion!: string; // Ej. 'Evaluación del tema 1'

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  valor_maximo!: number; // Ej. 100 (puntos máximos)

  @Column({ default: true })
  activo!: boolean; // Para desactivar sin eliminar

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      const random = Math.random().toString(36).substring(2, 10);
      this.id = `act_${random}`;
    }
  }
}
