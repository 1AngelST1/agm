import {
  Controller,
  Get,
  Post,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.entity';

@Controller('auth')
export class AppController {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService, // <-- Inyectamos el servicio JWT
  ) {}

  @Get()
  getStatus() {
    return { message: 'Microservicio de Auth conectado a BD' };
  }

  // --- NUEVA RUTA: LOGIN ---
  @Post('login')
  async login(@Body() body: { email: string }): Promise<any> {
    // 1. Buscamos si el correo existe en la base de datos
    const user = await this.userRepository.findOne({
      where: { email: body.email },
    });

    if (!user) {
      throw new UnauthorizedException('Correo no registrado en el sistema');
    }

    // 2. Si existe, creamos el "Payload" (la información que irá encriptada en el token)
    const payload = { sub: user.id, email: user.email, role: user.role };

    // 3. Firmamos el JWT y lo devolvemos al frontend
    return {
      mensaje: 'Login exitoso',
      access_token: this.jwtService.sign(payload), // <-- ¡La magia del Token!
      user_id: user.id,
      nombre: user.name,
    };
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
