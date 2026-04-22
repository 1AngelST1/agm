import { Entity, Column, PrimaryColumn, BeforeInsert } from 'typeorm';
import { randomBytes } from 'crypto';

@Entity()
export class User {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  role!: string;

  // TypeORM ejecutará esto automáticamente antes de hacer el INSERT
  @BeforeInsert()
  generateId() {
    // Genera un texto aleatorio cortito (ej. '8f4c2a1b')
    const randomCode = randomBytes(4).toString('hex');
    // Le pega el prefijo de tu microservicio
    this.id = `usr_${randomCode}`;
  }
}
