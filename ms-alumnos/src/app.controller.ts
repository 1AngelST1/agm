import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Inject,
  Param,
  OnModuleInit,
  NotFoundException,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alumno } from './alumno.entity';
import { Observable, lastValueFrom } from 'rxjs';
import { JwtAuthGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

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
  user_id: string;
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

  /**
   * ✅ GET /me
   * Obtener mis datos personales
   * Cualquier usuario autenticado (alumno, docente, admin)
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async obtenerMisDatos(@Request() req: { user: RequestUser }) {
    const usuario = req.user;
    // 1. Buscamos el alumno en la base de datos propia por USER_ID
    const alumnoLocal = await this.alumnoRepository.findOne({
      where: { user_id: usuario.user_id },
    });

    if (!alumnoLocal) {
      throw new NotFoundException(
        `No se encontró un registro de alumno para tu usuario.`,
      );
    }

    // 2. Llamamos a ms-auth vía gRPC para obtener datos adicionales
    const datosAuth = await lastValueFrom(
      this.authService.GetUserById({ userId: alumnoLocal.user_id }),
    );

    // 3. Fusión de datos
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

  /**
   * ✅ GET /:matricula
   * Obtener datos de un alumno por matrícula
   * Alumno: solo su propia matrícula
   * Docente/Admin: cualquier matrícula
   */
  @Get(':matricula')
  @UseGuards(JwtAuthGuard)
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

    // REGLA DE SEGURIDAD (RBAC): Alumno solo puede ver su propia matrícula
    const usuario = req.user;
    if (usuario.role === 'alumno') {
      if (alumnoLocal.user_id !== usuario.user_id) {
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

  /**
   * ✅ POST /crear
   * Crear un nuevo alumno
   * Solo Admin puede crear alumnos
   * Body debe incluir: user_id (del usuario recién creado), matricula, carrera
   */
  @Post('crear')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async crearAlumno(
    @Body()
    body: {
      user_id: string;
      matricula: string;
      carrera: string;
    },
  ) {
    console.log('DEBUG: Creating alumno with body:', body);
    
    const nuevoAlumno = this.alumnoRepository.create({
      user_id: body.user_id,
      matricula: body.matricula,
      carrera: body.carrera,
    });
    
    const resultado = await this.alumnoRepository.save(nuevoAlumno);
    console.log('✅ Alumno created:', resultado);
    return resultado;
  }

  /**
   * ✅ DELETE /baja/:matricula
   * Dar de baja a un alumno (solo el alumno de sí mismo, o admin)
   */
  @Delete('baja/:matricula')
  @UseGuards(JwtAuthGuard)
  async darDeBajaAlumno(
    @Param('matricula') matricula: string,
    @Request() req: { user: RequestUser },
  ) {
    const alumnoLocal = await this.alumnoRepository.findOne({
      where: { matricula },
    });

    if (!alumnoLocal) {
      throw new NotFoundException('Alumno no encontrado');
    }

    // Alumno solo puede darse de baja a sí mismo
    if (req.user.role === 'alumno' && alumnoLocal.user_id !== req.user.user_id) {
      throw new UnauthorizedException('Solo puedes darte de baja a ti mismo');
    }

    await this.alumnoRepository.delete(alumnoLocal.id);
    return { success: true, message: 'Alumno dado de baja' };
  }

  // 📡 MÉTODO gRPC: Validar alumno por matrícula (usado por ms-calificaciones)
  @GrpcMethod('AlumnosService', 'GetAlumnoByMatricula')
  async getAlumnoByMatricula(data: { matricula: string }) {
    const alumno = await this.alumnoRepository.findOne({
      where: { matricula: data.matricula },
    });

    if (!alumno) {
      throw new NotFoundException(
        `Alumno con matrícula ${data.matricula} no encontrado`,
      );
    }

    return {
      alumno_id: alumno.id,
      matricula: alumno.matricula,
      user_id: alumno.user_id,
      carrera: alumno.carrera,
    };
  }

  // 📡 MÉTODO gRPC: Obtener alumno por user_id (usado por ms-calificaciones para kardex)
  @GrpcMethod('AlumnosService', 'GetAlumnoByUserId')
  async getAlumnoByUserId(data: { user_id: string }) {
    const alumno = await this.alumnoRepository.findOne({
      where: { user_id: data.user_id },
    });

    if (!alumno) {
      throw new NotFoundException(
        `Alumno con user_id ${data.user_id} no encontrado`,
      );
    }

    return {
      alumno_id: alumno.id,
      matricula: alumno.matricula,
      user_id: alumno.user_id,
      carrera: alumno.carrera,
    };
  }
}
