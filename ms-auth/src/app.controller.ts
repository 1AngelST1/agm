import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Get,
  Headers,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.entity';
import { AppService } from './app.service';
import { TokenService } from './token.service';
import * as bcrypt from 'bcrypt';
import { GrpcMethod } from '@nestjs/microservices';

// DTOs
interface CrearUsuarioDto {
  name: string;
  email: string;
  password: string;
  role?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

interface CrearAdminDto {
  name: string;
  email: string;
  password: string;
}

@Controller('auth')
export class AppController {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
    private tokenService: TokenService,
    private appService: AppService,
  ) {}

  /**
   * Endpoint para crear el PRIMER administrador del sistema
   * Solo funciona si NO existe ningún admin aún
   * Una vez creado el primer admin, no se puede crear otro sin autenticación
   */
  @Post('crear-admin-inicial')
  async crearAdminInicial(@Body() body: CrearAdminDto): Promise<{
    message: string;
    user: { id: string; name: string; email: string; role: string };
  }> {
    // Verificar si ya existe un admin
    const yaExisteAdmin = await this.appService.existeAdmin();
    if (yaExisteAdmin) {
      throw new BadRequestException(
        'Ya existe un administrador en el sistema. Solo el administrador actual puede crear otros admins.',
      );
    }

    // Validar email
    const emailParts = body.email.split('@');
    if (emailParts.length !== 2) {
      throw new BadRequestException('Formato de correo inválido');
    }

    // Validar que sea un dominio autorizado (Solo admin para el Dios del sistema)
    const dominio = emailParts[1];
    const dominiosAutorizados = ['admin.buap.mx']; // 👈 Corregido para máxima seguridad
    if (!dominiosAutorizados.includes(dominio)) {
      throw new BadRequestException(
        'Dominio no autorizado. Use un correo @admin.buap.mx válido.',
      );
    }

    // Hashear contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    // Crear usuario con rol admin
    const nuevoAdmin = this.userRepository.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: 'admin',
    });

    const adminGuardado = await this.userRepository.save(nuevoAdmin);

    return {
      message: 'Administrador creado exitosamente',
      user: {
        id: adminGuardado.id,
        name: adminGuardado.name,
        email: adminGuardado.email,
        role: adminGuardado.role,
      },
    };
  }

  /**
   * Crear usuario estándar (alumno, docente)
   * Si intenta crear otro admin, EXIGE un token de administrador válido.
   */
  @Post('crear')
  async crearUsuario(
    @Body() body: CrearUsuarioDto,
    @Headers('authorization') authHeader?: string, // 👈 Atrapamos el Token
  ): Promise<User> {
    const emailParts = body.email.split('@');
    if (emailParts.length !== 2) {
      throw new BadRequestException('Formato de correo inválido');
    }
    const dominio = emailParts[1];
    let rolAsignado = '';

    // 🛑 LÓGICA DE ALTA SEGURIDAD PARA ADMINISTRADORES
    if (dominio === 'admin.buap.mx' || body.role === 'admin') {
      // A. Verificamos que ya exista el Admin Dios (Bootstrap)
      const yaExisteAdmin = await this.appService.existeAdmin();
      if (!yaExisteAdmin) {
        throw new BadRequestException(
          'Use el endpoint POST /auth/crear-admin-inicial para crear el primer administrador.',
        );
      }

      // B. 🔐 EL CANDADO DE PERMISOS: Verificamos quién está pidiendo esto
      if (!authHeader) {
        throw new UnauthorizedException(
          '¡Alto! Necesitas enviar el Token de un Administrador en la pestaña Auth para crear a otro.',
        );
      }

      // C. Leemos el token y verificamos que no sea un alumno o profesor tramposo
      const tokenArray = authHeader.split(' ');
      const token = tokenArray[1] || ''; // Quitamos la palabra "Bearer "
      try {
        const payload = this.tokenService.verifyToken(token);
        if (payload.role !== 'admin') {
          throw new UnauthorizedException(
            'Tu token es válido, pero no tienes permisos de Administrador.',
          );
        }
      } catch {
        throw new UnauthorizedException('Token inválido o expirado.');
      }

      rolAsignado = 'admin';
    }
    // 🟢 LÓGICA ABIERTA PARA DOCENTES
    else if (dominio === 'correo.buap.mx') {
      rolAsignado = 'docente';
    }
    // 🟢 LÓGICA ABIERTA PARA ALUMNOS
    else if (dominio === 'alumno.buap.mx') {
      rolAsignado = 'alumno';
    } else {
      throw new BadRequestException(
        'Dominio no autorizado. Solo se aceptan correos BUAP.',
      );
    }

    // Hashear contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    // ✅ VALIDACIÓN: Verificar si el email ya existe
    const usuarioExistente = await this.userRepository.findOne({
      where: { email: body.email },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        `El correo ${body.email} ya está registrado en el sistema. Por favor, usa otro correo.`,
      );
    }

    // Crear usuario
    const nuevoUsuario = this.userRepository.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: rolAsignado,
    });

    return await this.userRepository.save(nuevoUsuario);
  }

  /**
   * Endpoint para verificar si existe admin
   */
  @Get('admin-existe')
  async adminExiste(): Promise<{ existe: boolean; totalAdmins: number }> {
    const existe = await this.appService.existeAdmin();
    const total = await this.appService.getAdminCount();
    return {
      existe,
      totalAdmins: total,
    };
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
  ): Promise<{ access_token: string; role: string }> {
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

  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: {
    user_id?: string;
    userId?: string;
  }): Promise<{ user_id: string; name: string; email: string; role: string }> {
    // Atrapamos la variable, sin importar cómo la traduzca NestJS
    const idBuscado = data.userId || data.user_id;

    // EL CANDADO: Si llega vacío, cortamos la llamada de inmediato
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

  /**
   * 🔐 MÉTODO gRPC: ValidateToken
   * Otros microservicios lo llaman para validar un JWT y obtener los claims del usuario.
   * Devuelve el user_id, email y role si el token es válido.
   * Si no es válido, lanza una excepción.
   */
  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: {
    token?: string;
  }): Promise<{ userId: string; email: string; role: string }> {
    const token = data.token || '';

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    // Verifica el token usando TokenService
    const payload = this.tokenService.verifyToken(token);
    
    const response = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    
    console.log('✅ ValidateToken returning:', response);
    return response;
  }

  /**
   * 🔐 MÉTODO gRPC: CheckRole
   * Verifica si un usuario tiene un rol específico.
   * Devuelve true/false indicando si el usuario tiene ese rol.
   */
  @GrpcMethod('AuthService', 'CheckRole')
  async checkRole(data: {
    user_id?: string;
    userId?: string;
    role?: string;
  }): Promise<{ isAuthorized: boolean }> {
    const idBuscado = data.userId || data.user_id;
    const roleRequerido = data.role || '';

    if (!idBuscado || !roleRequerido) {
      throw new BadRequestException('user_id y role son requeridos');
    }

    const user = await this.userRepository.findOne({
      where: { id: idBuscado },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      isAuthorized: user.role === roleRequerido,
    };
  }
}
