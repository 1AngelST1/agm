import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sesiones_asistencia')
export class SesionAsistencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  profesor_id!: string;

  @Column()
  nrc!: string;

  @Column()
  codigo_sesion!: string;  // Identificador único de la sesión

  @Column({
    type: 'enum',
    enum: ['abierta', 'cerrada'],
    default: 'abierta',
  })
  estado!: string;

  @Column()
  duracion_minutos!: number;

  @CreateDateColumn()
  fecha_inicio!: Date;

  @Column({ nullable: true })
  fecha_cierre?: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
