import { Entity, Column, PrimaryColumn, BeforeInsert } from 'typeorm';
import { randomBytes } from 'crypto';

@Entity('alumnos')
export class Alumno {
  @PrimaryColumn()
  id!: string; // Este será el alu_...

  @Column()
  user_id!: string; // Aquí guardaremos el ID de ms-auth (usr_...)

  @Column({ unique: true })
  matricula!: string;

  @Column()
  carrera!: string;

  @BeforeInsert()
  generateId() {
    const randomCode = randomBytes(4).toString('hex');
    this.id = `alu_${randomCode}`;
  }
}
