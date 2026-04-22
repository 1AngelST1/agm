import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  NotFoundException, // <-- Agregado para manejar errores
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import { GrpcMethod } from '@nestjs/microservices'; // <-- Agregado para escuchar gRPC

// DTOs
interface CrearUsuarioDto {
  name: string;
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AppController {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  @Post('crear')
  async crearUsuario(@Body() body: CrearUsuarioDto) {
    const emailParts = body.email.split('@');
    if (emailParts.length !== 2) {
      throw new BadRequestException('Formato de correo inválido');
    }
    const dominio = emailParts[1];

    let rolAsignado = '';
    if (dominio === 'admin.buap.mx') {
      rolAsignado = 'admin';
    } else if (dominio === 'correo.buap.mx') {
      rolAsignado = 'docente';
    } else if (dominio === 'alumno.buap.mx') {
      rolAsignado = 'alumno';
    } else {
      throw new BadRequestException(
        'Dominio no autorizado. Solo se aceptan correos BUAP.',
      );
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    const nuevoUsuario = this.userRepository.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: rolAsignado,
    });

    return await this.userRepository.save(nuevoUsuario);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: body.email },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciales inválidas');

    // El token ahora viaja con el rol adentro
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      role: user.role,
    };
  }

  // 👇 EL MÉTODO MÁGICO CON SEGURO ANTI-ADMINS 👇
  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: { user_id?: string; userId?: string }) {
    // Atrapamos la variable, sin importar cómo la traduzca NestJS
    const idBuscado = data.userId || data.user_id;

    // 🛡️ EL CANDADO: Si llega vacío, cortamos la llamada de inmediato
    if (!idBuscado) {
      throw new BadRequestException('gRPC Error: ID de usuario no recibido');
    }

    const user = await this.userRepository.findOne({
      where: { id: idBuscado },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
