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
import { RabbitMQService } from './rabbitmq.service';
import { AlumnoInscritoEvent, AlumnoDesinscritoEvent, InscripcionRechazadaEvent, MateriaCargaLlenaEvent } from '@shared/events.types';
import { RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
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
  sendBajaNotif(data: any): Observable<any>;
}

interface AuthService {
  GetUserById(data: { userId: string }): Observable<AuthResponse>;
}

interface PeriodosService {
  GetMateriaById(data: any): Observable<any>;
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
    private rabbitmqService: RabbitMQService,
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

    console.log(`🚀 [ALUMNOS] Burlancho caché Docker. Inscribiendo Matrícula: ${body.matricula_alumno} | NRC: ${body.nrc_materia}`);

    // 🛡️QueryBuilder en crudo para evadir el error de EntityProperty
    const yaInscrito = await this.inscripcionRepository.createQueryBuilder("inscripcion")
      .where("inscripcion.matricula_alumno = :matricula", { matricula: body.matricula_alumno })
      .andWhere("inscripcion.nrc_materia = :nrc", { nrc: body.nrc_materia })
      .andWhere("inscripcion.estatus = :estatus", { estatus: 'activo' })
      .getOne();

    if (yaInscrito) {
      const eventoRechazo: InscripcionRechazadaEvent = {
        alumno_id: body.matricula_alumno,
        matricula: body.matricula_alumno,
        nrc_materia: body.nrc_materia,
        motivo: 'ya_inscrito',
        detalle: 'El alumno ya se encuentra inscrito en esta materia',
        fecha_rechazo: new Date(),
      };
      await this.rabbitmqService.publishEvent(RABBITMQ_ROUTING_KEYS.INSCRIPCION_RECHAZADA, eventoRechazo);
      return { mensaje: 'El alumno ya se encuentra inscrito actualmente.', inscripcion: yaInscrito };
    }

    // 🛡️Validar carga máxima
    const inscripcionesActivas = await this.inscripcionRepository.createQueryBuilder("inscripcion")
      .where("inscripcion.matricula_alumno = :matricula", { matricula: body.matricula_alumno })
      .andWhere("inscripcion.estatus = :estatus", { estatus: 'activo' })
      .getMany();

    const creditosActuales = inscripcionesActivas.length * 6; 
    const MAX_CREDITOS = 18;

    if (creditosActuales + 6 > MAX_CREDITOS) {
      const eventoRechazo: InscripcionRechazadaEvent = {
        alumno_id: body.matricula_alumno,
        matricula: body.matricula_alumno,
        nrc_materia: body.nrc_materia,
        motivo: 'carga_excedida',
        detalle: `Carga actual: ${creditosActuales} créditos. Máximo: ${MAX_CREDITOS}.`,
        fecha_rechazo: new Date(),
      };
      await this.rabbitmqService.publishEvent(RABBITMQ_ROUTING_KEYS.INSCRIPCION_RECHAZADA, eventoRechazo);
      return { mensaje: 'Superaría la carga máxima de créditos.', creditos_actuales: creditosActuales, max_creditos: MAX_CREDITOS };
    }

    let correoAlumno = req.user.email;
    let nombreMateria = `NRC: ${body.nrc_materia}`;
    let nombreAlumno = 'Estudiante';

    try {
      const materiaInfo = await lastValueFrom(
        this.periodosService.GetMateriaById({ materia_id: body.nrc_materia, materiaId: body.nrc_materia, nrc: body.nrc_materia } as any).pipe(timeout(3000))
      );
      if (materiaInfo && materiaInfo.nombre && materiaInfo.nombre !== 'Materia no encontrada') {
        nombreMateria = `${materiaInfo.clave} - ${materiaInfo.nombre}`;
      }
    } catch (errorMateria) {}

    try {
      const datosAuthAlumno = await lastValueFrom(
        this.authService.GetUserById({ userId: alumnoLocal.user_id }).pipe(timeout(3000))
      );
      if (datosAuthAlumno) {
        correoAlumno = datosAuthAlumno.email || correoAlumno;
        nombreAlumno = datosAuthAlumno.name || nombreAlumno;
      }
    } catch (errorQuery) {}

    const sufijoAleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // 🛡️ RGuardamos la inscripción de forma segura
    const nuevaInscripcion = this.inscripcionRepository.create({
      id: `INC-${sufijoAleatorio}`,
      matricula_alumno: body.matricula_alumno,
      nrc_materia: body.nrc_materia,
      estatus: 'activo'
    });
    await this.inscripcionRepository.save(nuevaInscripcion);

    try {
      const alumnoInscritoEvent: AlumnoInscritoEvent = {
        alumno_id: alumnoLocal.id,
        matricula: body.matricula_alumno,
        nrc_materia: body.nrc_materia,
        periodo: 'actual', 
        fecha_inscripcion: new Date(),
        docente_id: undefined, 
      };
      await this.rabbitmqService.publishEvent(RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO, alumnoInscritoEvent);
      console.log('✅ Evento alumno.inscrito publicado en RabbitMQ');
    } catch (errorRabbit) {}

    try {
      const inscritos = await this.inscripcionRepository.count({
        where: { nrc_materia: body.nrc_materia, estatus: 'activo' }
      });
      if (inscritos === 40) {
        await this.rabbitmqService.publishEvent(RABBITMQ_ROUTING_KEYS.MATERIA_CARGA_LLENA, {
          nrc_materia: body.nrc_materia, grupo_id: body.nrc_materia, capacidad_maxima: 40, inscritos_actuales: inscritos, timestamp: new Date()
        });
      }
    } catch (errorCapacidad) {}

    // 📤 ENVIAR CORREO DE INSCRIPCIÓN POR gRPC
    try {
      // 1. Extraemos el ID del usuario ligado a este alumno (ajusta 'alumnoLocal' al nombre de tu variable)
      const userIdAlumno = alumnoLocal.userId || alumnoLocal.user_id || alumnoLocal['user_id'];

      // 2. Le preguntamos a ms-auth los datos reales de ese estudiante
      const userData = await lastValueFrom(
        this.authService.GetUserById({ user_id: userIdAlumno, userId: userIdAlumno } as any).pipe(timeout(3000))
      );

      // 3. Extraemos los datos, o usamos un plan B
      const nombreReal = userData?.name || userData?.nombre || userData?.nombre_usuario || 'Estudiante';
      const correoReal = userData?.email || userData?.correo || req.user.email; // Solo usa req.user.email si Auth falla

      // 4. Armamos el payload híbrido
      const notifData = {
        nombreAlumno: nombreReal,       nombre_alumno: nombreReal,
        nombreMateria: nombreMateria,   nombre_materia: nombreMateria,
        emailDestino: correoReal,       email_destino: correoReal,
        matricula: alumnoLocal.matricula,
      };
      
      await lastValueFrom(this.notifService.sendBienvenida(notifData as any).pipe(timeout(5000)));
      console.log(`✅ Correo de inscripción enviado al estudiante real: ${correoReal}`);
    } catch (error) { 
      console.error('❌ Error enviando notificación de inscripción por gRPC:', (error as Error).message); 
    }

    return {
      message: '¡Inscripción exitosa!',
      inscripcion: nuevaInscripcion,
    };
  }

  /**
   * ✅ DELETE /alumnos/desinscribir/:nrc/:matricula
   * Dar de baja una inscripción (Soft Delete)
   */
  @Delete('desinscribir/:nrc/:matricula')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente', 'alumno')
  async darDeBajaInscripcion(
    @Param('nrc') nrc: string,
    @Param('matricula') matricula: string,
    @Request() req: { user: RequestUser },
  ) {
    const inscripcion = await this.inscripcionRepository.findOne({
      where: { 
        matricula_alumno: matricula, 
        nrc_materia: nrc,
        estatus: 'activo' 
      }
    });

    if (!inscripcion) {
      throw new NotFoundException('El alumno no está inscrito de forma activa en esta materia');
    }

    // 🔥 Cambio de estatus a 'baja' en lugar de borrar el registro
    inscripcion.estatus = 'baja';
    await this.inscripcionRepository.save(inscripcion);

    // 📤 Publicar evento alumno.desinscrito
    const evento: AlumnoDesinscritoEvent = {
      alumno_id: matricula,
      matricula: matricula,
      nrc_materia: nrc,
      motivo: 'baja_solicitada',
      fecha_desinscripcion: new Date(),
    };

    await this.rabbitmqService.publishEvent(
      RABBITMQ_ROUTING_KEYS.ALUMNO_DESINSCRITO,
      evento,
    );

    // 📤 ENVIAR CORREO DE BAJA POR gRPC
   try {
      const notifData = {
        nombreAlumno: "Estudiante",       nombre_alumno: "Estudiante",
        nombreMateria: `NRC: ${nrc}`,     nombre_materia: `NRC: ${nrc}`,
        emailDestino: req.user.email,     email_destino: req.user.email,
        matricula: matricula,
      };
      
      await lastValueFrom(this.notifService.sendBajaNotif(notifData as any).pipe(timeout(5000)));
    } catch (error) { console.error('❌ Error enviando notificación de baja'); }

    return {
      success: true,
      message: `El alumno con matrícula ${matricula} ha sido dado de baja de la materia correctamente.`,
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
    return { success: true, message: 'Alumno dado de baja del sistema general' };
  }

  @GrpcMethod('AlumnosService', 'GetAlumnoByMatricula')
  async getAlumnoByMatricula(data: { matricula: string }) {
    console.log('GetAlumnoByMatricula recibido:', JSON.stringify(data));
    
    const alumno = await this.alumnoRepository.findOne({
      where: { matricula: data.matricula },
    });

    if (!alumno) {
      throw new NotFoundException(
        `Alumno con matrícula ${data.matricula} no encontrado`,
      );
    }

    // 🔥 EL TRUCO ESTÁ AQUÍ: Usamos camelCase para engañar al formateador de NestJS
    const response = {
      alumnoId: alumno.id,           // En lugar de alumno_id
      nombre: 'Estudiante',
      matricula: alumno.matricula,
      userId: alumno.user_id || '',  // En lugar de user_id
    };

    console.log('📤 Respuesta gRPC (Lista para cruzar la red):', JSON.stringify(response, null, 2));
    
    return response;
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