import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('materias')
export class Materia {
  @PrimaryColumn()
  clave: string; // Ej. 'ITIS 260'

  @Column()
  nombre: string; // Ej. 'Servicios Web'

  @Column('decimal', { precision: 5, scale: 3 })
  creditos: number; // Ej. 6.000
}
