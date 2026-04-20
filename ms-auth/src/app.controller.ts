import { Controller, Get, Post, Body } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Controller('auth')
export class AppController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get()
  getStatus() {
    return { message: 'Microservicio de Auth conectado a BD' };
  }

  // NUEVO: Ruta REST para crear un usuario en la base de datos
  @Post('crear')
  async crearUsuario(@Body() body: { name: string; email: string }) {
    const nuevoUsuario = this.userRepository.create({
      name: body.name,
      email: body.email,
      role: 'user', // Por ahora todos los usuarios creados por esta ruta serán 'user'
    });
    return await this.userRepository.save(nuevoUsuario);
  }

  // El primer parámetro es el nombre del servicio en el proto, el segundo es el nombre del RPC
  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: { userId: string }) {
    // <-- NestJS lo transformó a userId

    console.log('gRPC recibido: Buscando usuario en BD:', data.userId);

    const user = await this.userRepository.findOne({
      where: { id: data.userId }, // <-- Buscamos por userId
    });

    if (!user) {
      return {};
    }

    return {
      user_id: user.id, // Al devolverlo sí respetamos el proto
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
