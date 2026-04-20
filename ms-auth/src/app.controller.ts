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

  @GrpcMethod('AuthService', 'ValidateToken')
  validateToken(data: { token: string }) {
    console.log('gRPC recibido: Validando token:', data.token);
    // Nota: Aún devolvemos esto inventado hasta que hagamos el login real
    return { userId: '123', email: 'angel@uni.mx', role: 'admin' };
  }

  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: { userId: string }) {
    console.log('gRPC recibido: Buscando usuario en BD:', data.userId);
    // Busca en la base de datos real
    const usuarioReal = await this.userRepository.findOne({
      where: { id: data.userId },
    });
    if (!usuarioReal) {
      console.log('Usuario no encontrado en BD');
      return { userId: 'no-encontrado', name: 'N/A', email: 'N/A' };
    }

    return {
      userId: usuarioReal.id,
      name: usuarioReal.name,
      email: usuarioReal.email,
    };
  }
}
