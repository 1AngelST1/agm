import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  Param,
  OnModuleInit,
  NotFoundException,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alumno } from './alumno.entity';
import { Observable, lastValueFrom } from 'rxjs';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

// 1. Definimos exactamente qué nos devuelve ms-auth
interface AuthResponse {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

// 2. Le decimos a TypeScript que esto devuelve un Observable de AuthResponse
interface AuthService {
  GetUserById(data: { userId: string }): Observable<AuthResponse>;
}

// 3. Definimos el tipo del usuario desde el token JWT
interface RequestUser {
  userId: string;
  email: string;
  role: string;
}

@Controller('alumnos')
export class AppController implements OnModuleInit {
  private authService!: AuthService;

  constructor(
    @Inject('AUTH_SERVICE') private client: ClientGrpc,
    @InjectRepository(Alumno) private alumnoRepository: Repository<Alumno>,
  ) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthService>('AuthService');
  }

  // --- EL MEGA-BUSCADOR DE ALUMNOS ---
  @UseGuards(JwtAuthGuard)
  @Get(':matricula')
  async getAlumnoCompleto(
    @Param('matricula') matricula: string,
    @Request() req: { user: RequestUser },
  ) {
    // 1. Buscamos el alumno en la base de datos propia (POR MATRÍCULA)
    const alumnoLocal = await this.alumnoRepository.findOne({
      where: { matricula: matricula },
    });

    if (!alumnoLocal) {
      throw new NotFoundException(
        `El alumno con matrícula ${matricula} no existe en los registros.`,
      );
    }

    //  NUEVA REGLA DE SEGURIDAD (RBAC) - A prueba de correos con nombres
    const usuario = req.user;
    if (usuario.role === 'alumno') {
      // Comparamos que el 'user_id' del expediente sea igual al ID del token ('userId' lo mapea tu JwtStrategy)
      if (alumnoLocal.user_id !== usuario.userId) {
        throw new UnauthorizedException(
          '¡Intruso! Solo puedes consultar tu propia matrícula.',
        );
      }
    }

    // 2. Llamamos a ms-auth vía gRPC (enviando userId)
    const datosAuth = await lastValueFrom(
      this.authService.GetUserById({ userId: alumnoLocal.user_id }),
    );

    // 3. ¡Fusión total de datos!
    return {
      alumno_id: alumnoLocal.id,
      nombre_completo: datosAuth.name,
      correo_contacto: datosAuth.email,
      matricula: alumnoLocal.matricula,
      carrera: alumnoLocal.carrera,
      status_cuenta: 'Activo',
      metadata: {
        rol_sistema: datosAuth.role,
        auth_ref: alumnoLocal.user_id,
      },
    };
  }

  @Post('crear')
  async crearAlumno(
    @Body()
    body: {
      user_id: string;
      matricula: string;
      carrera: string;
    },
  ) {
    const nuevoAlumno = this.alumnoRepository.create(body);
    return await this.alumnoRepository.save(nuevoAlumno);
  }
}
