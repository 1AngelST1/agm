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
import { Materia } from './materia.entity';
import { Grupo } from './grupo.entity';
import { Calificacion } from './calificacion.entity';
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

@Controller('calificaciones')
export class AppController implements OnModuleInit {
  private authService!: AuthService;

  constructor(
    @Inject('AUTH_SERVICE') private client: ClientGrpc,
    @InjectRepository(Materia) private materiaRepository: Repository<Materia>,
    @InjectRepository(Grupo) private grupoRepository: Repository<Grupo>,
    @InjectRepository(Calificacion)
    private calificacionRepository: Repository<Calificacion>,
  ) {}

  onModuleInit() {
    this.authService =
      this.client.getService<AuthService>('AuthService');
  }

  @Get()
  getHello() {
    return { message: 'ms-calificaciones está funcionando' };
  }

  @Get('materias')
  @UseGuards(JwtAuthGuard)
  async obtenerMaterias() {
    const materias = await this.materiaRepository.find();
    return materias;
  }

  @Post('materias')
  @UseGuards(JwtAuthGuard)
  async crearMateria(
    @Body()
    materia: {
      clave: string;
      nombre: string;
      creditos: number;
    },
    @Request() req: { user: RequestUser },
  ) {
    // Verificar que el usuario es admin
    const usuarioEnAuth = await lastValueFrom(
      this.authService.GetUserById({ userId: req.user.userId }),
    );

    if (usuarioEnAuth.role !== 'admin') {
      throw new UnauthorizedException('Solo admins pueden crear materias');
    }

    const nuevaMateria = this.materiaRepository.create(materia);
    return this.materiaRepository.save(nuevaMateria);
  }

  @Get('grupos')
  @UseGuards(JwtAuthGuard)
  async obtenerGrupos() {
    const grupos = await this.grupoRepository.find({
      relations: ['materia'],
    });
    return grupos;
  }

  @Get('calificaciones/:matricula')
  @UseGuards(JwtAuthGuard)
  async obtenerCalificacionesAlumno(
    @Param('matricula') matricula: string,
  ) {
    const calificaciones = await this.calificacionRepository.find({
      where: { matricula_alumno: matricula },
      relations: ['grupo', 'grupo.materia'],
    });

    if (!calificaciones.length) {
      throw new NotFoundException(
        `No se encontraron calificaciones para la matrícula: ${matricula}`,
      );
    }

    return calificaciones;
  }
}
