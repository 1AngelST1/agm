import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  Param,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { GrpcMethod } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alumno } from './alumno.entity';

interface AuthService {
  GetUserById(data: { user_id: string }): any;
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

  // --- NUEVO: RUTA PARA CREAR ALUMNOS EN LA BD ---
  @Post('crear')
  async crearAlumno(
    @Body()
    body: {
      user_id: string;
      matricula: string;
      carrera: string;
    },
  ): Promise<any> {
    const nuevoAlumno = this.alumnoRepository.create({
      user_id: body.user_id,
      matricula: body.matricula,
      carrera: body.carrera,
    });
    return await this.alumnoRepository.save(nuevoAlumno);
  }

  // --- RESTO DE TU CÓDIGO (No lo borres) ---
  @Get(':id')
  getAlumnoInfoREST(@Param('id') id: string): any {
    return this.authService.GetUserById({ user_id: id });
  }

  @GrpcMethod('AlumnosService', 'GetAlumnoById')
  getAlumnoByIdGrpc(data: { alumno_id: string }): any {
    return {
      alumno_id: data.alumno_id,
      nombre: 'Alumno de Prueba',
      matricula: '2022001122',
    };
  }
}
