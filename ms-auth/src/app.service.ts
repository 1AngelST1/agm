import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  /**
   * Verifica si existe algún administrador en el sistema
   */
  async existeAdmin(): Promise<boolean> {
    const adminCount = await this.userRepository.count({
      where: { role: 'admin' },
    });
    return adminCount > 0;
  }

  /**
   * Obtiene el total de administradores
   */
  async getAdminCount(): Promise<number> {
    return await this.userRepository.count({
      where: { role: 'admin' },
    });
  }

  getHello(): string {
    return 'Hello World!';
  }
}
