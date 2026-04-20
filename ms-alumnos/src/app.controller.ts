import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  Param,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alumno } from './alumno.entity';
import { Observable, lastValueFrom } from 'rxjs';

// 1. Definimos exactamente qué nos devuelve ms-auth
interface AuthResponse {
  id: string;
  name: string;
  email: string;
  role: string;
}

// 2. Le decimos a TypeScript que esto devuelve un Observable de AuthResponse
interface AuthService {
  GetUserById(data: { userId: string }): Observable<AuthResponse>;
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

  // --- EL MEGA-BUSCADOR AGREGADOR ---
  @Get(':id')
  async getAlumnoCompleto(@Param('id') id: string) {
    // 1. Buscamos el alumno en la base de datos propia
    const alumnoLocal = await this.alumnoRepository.findOne({ where: { id } });

    if (!alumnoLocal) {
      throw new NotFoundException(
        `El alumno con ID ${id} no existe en los registros académicos.`,
      );
    }

    // 2. Llamamos a ms-auth vía gRPC para obtener datos de la cuenta
    // ✅ Ya no hay errores de TS porque la interfaz devuelve el Observable correcto
    const datosAuth = await lastValueFrom(
      this.authService.GetUserById({ userId: alumnoLocal.user_id }),
    );

    // 3. ¡Fusión total de datos!
    return {
      alumno_id: alumnoLocal.id,
      nombre_completo: datosAuth.name, // ✅ Corregido a 'name'
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
