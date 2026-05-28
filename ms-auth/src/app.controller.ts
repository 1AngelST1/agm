import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Get,
  Headers,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.entity';
import { AppService } from './app.service';
import { TokenService } from './token.service';
import * as bcrypt from 'bcrypt';
import { GrpcMethod } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';

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

interface NotificacionesServiceClient {
  SendBienvenida(data: any): Observable<any>;
  SendCuentaCreada(data: any): Observable<any>;
}

@Controller('auth')
export class AppController implements OnModuleInit {
  private notificacionesService!: NotificacionesServiceClient;

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
    private tokenService: TokenService,
    private appService: AppService,
    @Inject('NOTIFICACIONES_SERVICE') private notificacionesClient: ClientGrpc, // 🔥 Inyección de gRPC
  ) {}

  onModuleInit() {
    this.notificacionesService = this.notificacionesClient.getService<NotificacionesServiceClient>('NotificacionesService');
  }

  @Post('crear-admin-inicial')
  async crearAdminInicial(@Body() body: CrearAdminDto): Promise<{
    message: string;
    user: { id: string; name: string; email: string; role: string };
  }> {
    const yaExisteAdmin = await this.appService.existeAdmin();
    if (yaExisteAdmin) {
      throw new BadRequestException(
        'Ya existe un administrador en el sistema. Solo el administrador actual puede crear otros admins.',
      );
    }

    const emailParts = body.email.split('@');
    if (emailParts.length !== 2) throw new BadRequestException('Formato de correo inválido');

    const dominio = emailParts[1];
    const dominiosAutorizados = ['admin.buap.mx'];
    if (!dominiosAutorizados.includes(dominio)) {
      throw new BadRequestException('Dominio no autorizado. Use un correo @admin.buap.mx válido.');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    const nuevoAdmin = this.userRepository.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: 'admin',
    });

    const adminGuardado = await this.userRepository.save(nuevoAdmin);

    // 📤 ENVIAR CORREO AL NUEVO ADMINISTRADOR
    await this.enviarCorreoBienvenida(adminGuardado.name, adminGuardado.email, adminGuardado.role);

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

  @Post('crear')
  async crearUsuario(
    @Body() body: CrearUsuarioDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<User> {
    const emailParts = body.email.split('@');
    if (emailParts.length !== 2) throw new BadRequestException('Formato de correo inválido');
    const dominio = emailParts[1];
    let rolAsignado = '';

    if (dominio === 'admin.buap.mx' || body.role === 'admin') {
      const yaExisteAdmin = await this.appService.existeAdmin();
      if (!yaExisteAdmin) {
        throw new BadRequestException('Use el endpoint POST /auth/crear-admin-inicial para crear el primer administrador.');
      }
      if (!authHeader) {
        throw new UnauthorizedException('¡Alto! Necesitas enviar el Token de un Administrador en la pestaña Auth para crear a otro.');
      }

      const tokenArray = authHeader.split(' ');
      const token = tokenArray[1] || '';
      try {
        const payload = this.tokenService.verifyToken(token);
        if (payload.role !== 'admin') {
          throw new UnauthorizedException('Tu token es válido, pero no tienes permisos de Administrador.');
        }
      } catch {
        throw new UnauthorizedException('Token inválido o expirado.');
      }

      rolAsignado = 'admin';
    }
    else if (dominio === 'correo.buap.mx') {
      rolAsignado = 'docente';
    }
    else if (dominio === 'alumno.buap.mx') {
      rolAsignado = 'alumno';
    } else {
      throw new BadRequestException('Dominio no autorizado. Solo se aceptan correos BUAP.');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.password, saltRounds);

    const nuevoUsuario = this.userRepository.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: rolAsignado,
    });

    const usuarioGuardado = await this.userRepository.save(nuevoUsuario);

    // 📤 ENVIAR CORREO AL NUEVO USUARIO
    await this.enviarCorreoBienvenida(usuarioGuardado.name, usuarioGuardado.email, usuarioGuardado.role);

    return usuarioGuardado;
  }

  @Get('admin-existe')
  async adminExiste(): Promise<{ existe: boolean; totalAdmins: number }> {
    const existe = await this.appService.existeAdmin();
    const total = await this.appService.getAdminCount();
    return { existe, totalAdmins: total };
  }

  @Post('login')
  async login(@Body() body: LoginDto): Promise<{ access_token: string; role: string }> {
    const user = await this.userRepository.findOne({ where: { email: body.email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: this.jwtService.sign(payload),
      role: user.role,
    };
  }

  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: { user_id?: string; userId?: string }) {
    const idBuscado = data.userId || data.user_id;
    if (!idBuscado) throw new BadRequestException('gRPC Error: ID no recibido');

    const user = await this.userRepository.findOne({ where: { id: idBuscado } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return { 
      user_id: user.id,   // 🔥 Versión snake_case (Para el .proto)
      userId: user.id,    // 🔥 Versión camelCase (Para NestJS)
      name: user.name, 
      email: user.email, 
      role: user.role 
    };
  }

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: { token?: string }) {
    const token = data.token || '';
    if (!token) throw new UnauthorizedException('Token no proporcionado');

    const payload = this.tokenService.verifyToken(token);
    const response = { 
      user_id: payload.sub, // 🔥 Versión snake_case
      userId: payload.sub,  // 🔥 Versión camelCase
      email: payload.email, 
      role: payload.role 
    };
    
    console.log('✅ ValidateToken returning:', response);
    return response;
  }

  @GrpcMethod('AuthService', 'CheckRole')
  async checkRole(data: { user_id?: string; userId?: string; role?: string }): Promise<{ isAuthorized: boolean }> {
    const idBuscado = data.userId || data.user_id;
    const roleRequerido = data.role || '';

    if (!idBuscado || !roleRequerido) throw new BadRequestException('user_id y role son requeridos');

    const user = await this.userRepository.findOne({ where: { id: idBuscado } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return { isAuthorized: user.role === roleRequerido };
  }

// ==========================================
  // ✉️ MÉTODO PRIVADO PARA NOTIFICACIONES
  // ==========================================
  private async enviarCorreoBienvenida(nombre: string, email: string, rol: string) {
    try {
      const payload = {
        nombre_usuario: nombre,
        nombreUsuario: nombre, 
        email_destino: email,
        emailDestino: email,
        rol: rol
      };

      // 🔥 Ahora disparamos al nuevo método dedicado
      await firstValueFrom(this.notificacionesService.SendCuentaCreada(payload as any).pipe(timeout(3000)));
      console.log(`✅ Correo de cuenta creada enviado a: ${email}`);
    } catch (error) { 
      console.error(`❌ Error silencioso enviando correo a ${email}:`, (error as Error).message); 
    }
  }
}