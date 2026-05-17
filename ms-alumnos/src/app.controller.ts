/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */

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
import { Inscripcion } from './inscripcion.entity';
import { Observable, lastValueFrom, timeout } from 'rxjs';
import { JwtAuthGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import * as crypto from 'crypto';

interface AuthResponse {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

interface NotificacionesService {
  sendBienvenida(data: {
    nombreAlumno?: string;
    nombreMateria?: string;
    emailDestino?: string;
    matricula?: string;
    nombre_alumno?: string;
    nombre_materia?: string;
    email_destino?: string;
  }): Observable<any>;
}

interface AuthService {
  GetUserById(data: { userId: string }): Observable<AuthResponse>;
}

interface PeriodosService {
  GetMateriaById(data: { materia_id: string }): Observable<any>;
}

interface RequestUser {
  user_id: string;
  email: string;
  role: string;
}

@Controller('alumnos')
export class AppController implements OnModuleInit {
  private authService!: AuthService;
  private notifService!: NotificacionesService;
  private periodosService!: PeriodosService;

  constructor(
    @Inject('AUTH_SERVICE') private client: ClientGrpc,
    @Inject('NOTIFICACIONES_SERVICE') private notifClient: ClientGrpc,
    @Inject('PERIODOS_SERVICE') private periodosClient: ClientGrpc,
    @InjectRepository(Alumno) private alumnoRepository: Repository<Alumno>,
    @InjectRepository(Inscripcion)
    private inscripcionRepository: Repository<Inscripcion>,
  ) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthService>('AuthService');
    this.notifService = this.notifClient.getService<NotificacionesService>(
      'NotificacionesService',
    );
    this.periodosService = this.periodosClient.getService<PeriodosService>('PeriodosService');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async obtenerMisDatos(@Request() req: { user: RequestUser }) {
    const usuario = req.user;
    const alumnoLocal = await this.alumnoRepository.findOne({
      where: { user_id: usuario.user_id },
    });

    if (!alumnoLocal) {
      throw new NotFoundException(
        `No se encontró un registro de alumno para tu usuario.`,
      );
    }

    const datosAuth = await lastValueFrom(
      this.authService.GetUserById({ userId: alumnoLocal.user_id }),
    );

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

  @Get(':matricula')
  @UseGuards(JwtAuthGuard)
  async getAlumnoCompleto(
    @Param('matricula') matricula: string,
    @Request() req: { user: RequestUser },
  ) {
    const alumnoLocal = await this.alumnoRepository.findOne({
      where: { matricula: matricula },
    });

    if (!alumnoLocal) {
      throw new NotFoundException(
        `El alumno con matrícula ${matricula} no existe en los registros.`,
      );
    }

    const usuario = req.user;
    if (usuario.role === 'alumno') {
      if (alumnoLocal.user_id !== usuario.user_id) {
        throw new UnauthorizedException(
          '¡Intruso! Solo puedes consultar tu propia matrícula.',
        );
      }
    }

    const datosAuth = await lastValueFrom(
      this.authService.GetUserById({ userId: alumnoLocal.user_id }),
    );

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
    const nuevoAlumno = this.alumnoRepository.create({
      user_id: body.user_id,
      matricula: body.matricula,
      carrera: body.carrera,
    });

    const resultado = await this.alumnoRepository.save(nuevoAlumno);
    return resultado;
  }

  /**
   * ✅ POST /alumnos/inscribir
   * Inscripción dinámica
   */
  @Post('inscribir')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'alumno')
  async inscribirMateria(
    @Body() body: { matricula_alumno: string; nrc_materia: string },
    @Request() req: { user: RequestUser },
  ) {
    const alumnoLocal = await this.alumnoRepository.findOne({
      where: { matricula: body.matricula_alumno },
    });

    if (!alumnoLocal) {
      throw new NotFoundException('No se puede inscribir: El alumno no existe en el sistema.');
    }

    const yaInscrito = await this.inscripcionRepository.findOne({
      where: { 
        matricula_alumno: body.matricula_alumno, 
        nrc_materia: body.nrc_materia 
      }
    });

    if (yaInscrito) {
      return { 
        message: 'El alumno ya se encuentra inscrito en esta asignatura.', 
        inscripcion: yaInscrito 
      };
    }

    let correoAlumno = req.user.email;
    let nombreMateria = `NRC: ${body.nrc_materia}`;
    let nombreAlumno = 'Estudiante';

    // 1️⃣ Intentar obtener el nombre de la materia desde ms-periodos
    try {
      console.log('🔍 Consultando materia con NRC:', body.nrc_materia);
      const materiaInfo = await lastValueFrom(
        this.periodosService.GetMateriaById({ materia_id: body.nrc_materia }).pipe(timeout(3000))
      );
      console.log('✅ Datos de materia:', materiaInfo);
      if (materiaInfo && materiaInfo.nombre) {
        nombreMateria = `${materiaInfo.clave} - ${materiaInfo.nombre}`;
        console.log('📚 Nombre materia actualizado:', nombreMateria);
      }
    } catch (errorMateria) {
      console.error('❌ Error obteniendo materia:', (errorMateria as Error).message);
    }

    // 2️⃣ Intentar obtener datos del alumno (nombre y email)
    try {
      console.log('🔍 Consultando datos del alumno, user_id:', alumnoLocal.user_id);
      const datosAuthAlumno = await lastValueFrom(
        this.authService.GetUserById({ userId: alumnoLocal.user_id }).pipe(timeout(3000))
      );
      console.log('✅ Datos de auth:', datosAuthAlumno);
      if (datosAuthAlumno) {
        if (datosAuthAlumno.email) {
          correoAlumno = datosAuthAlumno.email;
          console.log('📧 Email actualizado:', correoAlumno);
        }
        if (datosAuthAlumno.name) {
          nombreAlumno = datosAuthAlumno.name;
          console.log('👤 Nombre alumno actualizado:', nombreAlumno);
        }
      }
    } catch (errorQuery) {
      console.error('❌ Error obteniendo datos del alumno:', (errorQuery as Error).message);
    }

    console.log('📨 Datos finales para notificación:', { nombreAlumno, nombreMateria, correoAlumno });

    const sufijoAleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();
    const nuevaInscripcion = this.inscripcionRepository.create({
      id: `INC-${sufijoAleatorio}`,
      matricula_alumno: body.matricula_alumno,
      nrc_materia: body.nrc_materia,
    });

    await this.inscripcionRepository.save(nuevaInscripcion);

    try {
      const notifData = {
        nombreAlumno: nombreAlumno,
        nombreMateria: nombreMateria,
        emailDestino: correoAlumno,
        matricula: alumnoLocal.matricula,
      };
      
      console.log('📤 ENVIANDO A NOTIFICACIONES:', JSON.stringify(notifData, null, 2));
      
      this.notifService
        .sendBienvenida(notifData)
        .subscribe({
          next: (res) => console.log('📩 Notificación enviada desde MS-Alumnos:', res),
          error: (err) => console.error('❌ Falló gRPC:', err),
        });
    } catch (_error) {
      console.log('⚠️ No se pudo conectar con MS-Notificaciones.');
    }

    return {
      message: '¡Inscripción exitosa!',
      inscripcion: nuevaInscripcion,
    };
  }

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

    if (
      req.user.role === 'alumno' &&
      alumnoLocal.user_id !== req.user.user_id
    ) {
      throw new UnauthorizedException('Solo puedes darte de baja a ti mismo');
    }

    await this.alumnoRepository.delete(alumnoLocal.id);
    return { success: true, message: 'Alumno dado de baja' };
  }

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