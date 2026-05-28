import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  Inject,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { AlumnoInscritoEvent, AsistenciaResumenCalculadoEvent, CalificacionFinalAsignadaEvent } from '@shared/events.types';
import { RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
import { RabbitMQService } from './rabbitmq.service';

import { Materia } from './materia.entity';
import { Grupo } from './grupo.entity';
import { Calificacion } from './calificacion.entity';
import { Ponderacion } from './ponderacion.entity';
import { Actividad } from './actividad.entity';
import {
  CreateMateriaDto,
  CreateGrupoDto,
  CreateCalificacionDto,
  UpdateCalificacionDto,
  CreatePonderacionDto,
  UpdatePonderacionDto,
  CreateActividadDto,
  UpdateActividadDto,
  validatePonderacionSum,
} from './dtos';
import { JwtAuthGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: 'admin' | 'docente' | 'alumno' };
}

interface AlumnosServiceClient {
  GetAlumnoByMatricula(data: { matricula: string }): Observable<any>;
  GetAlumnoByUserId(data: { user_id: string }): Observable<any>;
}

interface AuthServiceClient {
  GetUserById(data: { user_id: string; userId?: string }): Observable<any>;
}

interface NotificacionesServiceClient {
  SendBienvenida(data: any): Observable<any>;
  SendBajaNotif(data: any): Observable<any>;
  SendActualizacion(data: any): Observable<any>;
}

interface PeriodosServiceClient {
  GetMateriaById(data: { nrc: string }): Observable<any>;
}

@Controller('calificaciones')
export class AppController implements OnModuleInit {
  private logger = new Logger('CalificacionesController');
  private authService!: AuthServiceClient;
  private alumnosService!: AlumnosServiceClient;
  private notificacionesService!: NotificacionesServiceClient;
  private periodosService!: PeriodosServiceClient;

  constructor(
    @InjectRepository(Materia) private materiaRepository: Repository<Materia>,
    @InjectRepository(Grupo) private grupoRepository: Repository<Grupo>,
    @InjectRepository(Calificacion)
    private calificacionRepository: Repository<Calificacion>,
    @InjectRepository(Ponderacion) private ponderacionRepository: Repository<Ponderacion>,
    @InjectRepository(Actividad) private actividadRepository: Repository<Actividad>,
    @Inject('AUTH_SERVICE') private authClient: ClientGrpc,
    @Inject('ALUMNOS_SERVICE') private alumnosClient: ClientGrpc,
    @Inject('NOTIFICACIONES_SERVICE') private notificacionesClient: ClientGrpc,
    @Inject('PERIODOS_SERVICE') private periodosClient: ClientGrpc,
    private rabbitmqService: RabbitMQService,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>('AuthService');
    this.alumnosService = this.alumnosClient.getService<AlumnosServiceClient>('AlumnosService');
    this.notificacionesService = this.notificacionesClient.getService<NotificacionesServiceClient>('NotificacionesService');
    this.periodosService = this.periodosClient.getService<PeriodosServiceClient>('PeriodosService');
  }

  /**
   * ✅ GET /
   * Health check (público)
   */
  @Get()
  getHello() {
    return { message: 'ms-calificaciones activo en puerto 3003' };
  }

  /**
   * ✅ GET /materias
   * Listar todas las materias (público)
   */
  @Get('materias')
  async obtenerMaterias() {
    return await this.materiaRepository.find();
  }

  /**
   * ✅ POST /materia
   * Crear nueva materia (admin, docente)
   */
  @Post('materia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async crearMateria(@Body() dto: CreateMateriaDto) {
    const existe = await this.materiaRepository.findOne({ where: { clave: dto.clave } });
    if (existe) throw new BadRequestException(`Ya existe la clave ${dto.clave}`);
    return await this.materiaRepository.save(this.materiaRepository.create(dto));
  }

  /**
   * ✅ GET /grupos
   * Listar grupos (público)
   */
  @Get('grupos')
  async obtenerGrupos() {
    return await this.grupoRepository.find({ relations: ['materia'] });
  }

  /**
   * ✅ POST /grupo
   * Crear nuevo grupo (admin, docente)
   */
  @Post('grupo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async crearGrupo(@Body() dto: CreateGrupoDto, @Req() req: AuthenticatedRequest) {
    const grupoExistente = await this.grupoRepository.findOne({ where: { nrc: dto.nrc } });
    if (grupoExistente) throw new BadRequestException(`Ya existe un grupo con NRC ${dto.nrc}. Use PUT para actualizar.`);
    
    const materia = await this.materiaRepository.findOne({ where: { clave: dto.materia_clave } });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    
    let docenteId: string;
    if (req.user.role === 'admin' && dto.docente_id) {
      docenteId = dto.docente_id;
    } else if (req.user.role === 'docente' || req.user.role === 'admin') {
      docenteId = req.user.userId;
    } else {
      docenteId = 'admin_default';
    }
    
    return await this.grupoRepository.save(this.grupoRepository.create({
      nrc: dto.nrc, materia, docente_id: docenteId, seccion: dto.seccion, periodo: dto.periodo,
    }));
  }

  /**
   * ✅ POST /calificar
   * Registrar calificación (admin, docente)
   */
  @Post('calificar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async calificarAlumno(
    @Body() dto: CreateCalificacionDto,
  ) {
    const calificacionExistente = await this.calificacionRepository.findOne({
      where: { nrc_grupo: dto.nrc_grupo, matricula_alumno: dto.matricula_alumno }
    });
    if (calificacionExistente) {
      throw new BadRequestException(
        `Ya existe una calificación para el alumno ${dto.matricula_alumno} en el grupo ${dto.nrc_grupo}. Use PUT para actualizar.`
      );
    }

    try {
      console.log('ENVIANDO A PERIODOS - nrc_grupo:', dto.nrc_grupo, 'tipo:', typeof dto.nrc_grupo);
      const materiaInfo = await firstValueFrom(
        this.periodosService.GetMateriaById({ nrc: dto.nrc_grupo }).pipe(timeout(5000))
      );

      if (!materiaInfo || !materiaInfo.nombre) {
        throw new NotFoundException(
          'La materia con ese NRC no existe en el periodo activo',
        );
      }

      console.log(
        `✅ Validado en MS-2 (Periodos): ${materiaInfo.nombre} (${materiaInfo.creditos} créditos)`,
      );
    } catch (error) {
      console.error('❌ Error validando materia en MS-2:', (error as Error).message);
      throw new NotFoundException(
        'Error validando la materia con el servicio de Periodos',
      );
    }

    const grupo = await this.grupoRepository.findOne({
      where: { nrc: dto.nrc_grupo },
      relations: ['materia'],
    });
    if (!grupo) throw new NotFoundException('El grupo no existe.');

    if (dto.actividad_id) {
      const actividad = await this.actividadRepository.findOne({ where: { id: dto.actividad_id } });
      if (!actividad) {
        throw new NotFoundException(`La actividad ${dto.actividad_id} no existe`);
      }
      if (actividad.nrc_grupo !== dto.nrc_grupo) {
        throw new BadRequestException(
          `La actividad ${dto.actividad_id} no pertenece al grupo ${dto.nrc_grupo}`
        );
      }
    }

    const estatus = dto.calificacion_ordinaria >= 6 ? 'Aprobado' : 'Reprobado';
    const calificacionGuardada = await this.calificacionRepository.save(
      this.calificacionRepository.create({
        grupo,
        matricula_alumno: dto.matricula_alumno,
        calificacion_ordinaria: dto.calificacion_ordinaria,
        estatus,
        tipo_calificacion: dto.tipo_calificacion,
        actividad_id: dto.actividad_id,
      }),
    );

    await this.enviarNotificacionRegistro(dto.matricula_alumno, calificacionGuardada, dto.nrc_grupo, dto.tipo_calificacion || 'ordinaria');

    return calificacionGuardada;
  }

/**
   * ✅ PUT /:nrc/:matricula
   * Actualizar calificación (admin, docente)
   */
  @Put(':nrc/:matricula')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async actualizarCalificacion(@Param('nrc') nrc: string, @Param('matricula') matricula: string, @Body() dto: UpdateCalificacionDto) {
    const calificacion = await this.calificacionRepository.findOne({ 
      where: { matricula_alumno: matricula, nrc_grupo: nrc }, 
      relations: ['grupo', 'grupo.materia'] 
    });
    
    if (!calificacion) throw new NotFoundException('Registro no encontrado');

    // 🔥 LA MAGIA: Guardamos la nota vieja antes de que la sobrescribas
    const notaAnterior = calificacion.calificacion_ordinaria;

    calificacion.calificacion_ordinaria = dto.calificacion_ordinaria;
    calificacion.estatus = dto.calificacion_ordinaria >= 6 ? 'Aprobado' : 'Reprobado';
    const resultado = await this.calificacionRepository.save(calificacion);

    // Le pasamos la 'notaAnterior' como un número suelto a la función del correo
    await this.enviarNotificacionActualizacion(matricula, notaAnterior, dto.calificacion_ordinaria, nrc, calificacion.tipo_calificacion || 'ordinaria');

    return resultado;
  }

  /**
   * ✅ DELETE /:nrc/:matricula
   * Eliminar calificación / dar de baja alumno (admin, docente)
   */
  @Delete(':nrc/:matricula')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async eliminarCalificacion(@Param('nrc') nrc: string, @Param('matricula') matricula: string) {
    const calificacion = await this.calificacionRepository.findOne({ 
      where: { matricula_alumno: matricula, nrc_grupo: nrc }, 
      relations: ['grupo', 'grupo.materia'] 
    });

    if (!calificacion) throw new NotFoundException('No existe el registro');
    
    const matNombre = calificacion.grupo?.materia 
      ? `${calificacion.grupo.materia.clave} - ${calificacion.grupo.materia.nombre}` 
      : nrc;
    
    await this.calificacionRepository.remove(calificacion);

    await this.enviarNotificacionBaja(matricula, matNombre, calificacion.tipo_calificacion || 'ordinaria');

    return { message: 'Alumno dado de baja exitosamente', matricula_alumno: matricula };
  }

  /**
   * ✅ POST /asignar-final
   * Asignar calificación final y publicar evento
   */
  @Post('asignar-final')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async asignarCalificacionFinal(
    @Body() body: { matricula: string; nrc_materia: string; calificacion_final: number; derecho_proyecto: boolean }
  ) {
    const calificacion = await this.calificacionRepository.findOne({
      where: { matricula_alumno: body.matricula, nrc_grupo: body.nrc_materia },
      relations: ['grupo', 'grupo.materia'],
    });

    if (!calificacion) throw new NotFoundException('Calificación no encontrada');

    // Actualizar calificación final
    calificacion.calificacion_final = body.calificacion_final;
    calificacion.estatus = body.calificacion_final >= 6 ? 'Aprobado' : 'Reprobado';

    await this.calificacionRepository.save(calificacion);

    // 📤 Publicar evento calificacion.final.asignada
    const evento: CalificacionFinalAsignadaEvent = {
      alumno_id: body.matricula,
      matricula: body.matricula,
      nrc_materia: body.nrc_materia,
      calificacion_final: body.calificacion_final,
      derecho_proyecto: body.derecho_proyecto,
      estatus: calificacion.estatus.toLowerCase() as 'aprobado' | 'reprobado' | 'condicional',
      fecha_asignacion: new Date(),
      asignado_por: 'Sistema',
    };

    await this.rabbitmqService.publishEvent(
      RABBITMQ_ROUTING_KEYS.CALIFICACION_FINAL_ASIGNADA,
      evento,
    );

    this.logger.log(
      `📤 Evento calificacion.final.asignada publicado para ${body.matricula}`
    );

    return {
      mensaje: 'Calificación final asignada exitosamente',
      matricula: body.matricula,
      nrc_materia: body.nrc_materia,
      calificacion_final: body.calificacion_final,
      estatus: calificacion.estatus,
    };
  }

  /**
   * ✅ GET /kardex/mi-kardex
   * Ver mi kardex (solo alumno autenticado)
   */
  @Get('kardex/mi-kardex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('alumno', 'docente', 'admin')
  async verMiKardex(@Req() req: AuthenticatedRequest) {
    const alumno = await firstValueFrom(this.alumnosService.GetAlumnoByUserId({ user_id: req.user.userId }));
    return await this.calificacionRepository.find({ where: { matricula_alumno: alumno.matricula }, relations: ['grupo', 'grupo.materia'] });
  }

  // ==========================================
  // ✉️ MÉTODOS PRIVADOS PARA NOTIFICACIONES
  // ==========================================

private async enviarNotificacionActualizacion(matricula: string, notaAnterior: number, nuevaNota: number, nrc: string, tipo_calificacion: string) {
    try {
      const alumnoData = await firstValueFrom(this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000)));
      const userId = alumnoData?.userId || alumnoData?.user_id || alumnoData?.['user_id'];
      
      if (!userId) return; 

      const userData = await firstValueFrom(this.authService.GetUserById({ user_id: userId, userId: userId } as any).pipe(timeout(3000)));
      const nombreAlumno = userData?.name || userData?.nombre || userData?.nombre_usuario || 'Estudiante';
      const emailAlumno = userData?.email || userData?.correo || 'sin-email@buap.mx';

      const materiaData = await firstValueFrom(this.periodosService.GetMateriaById({ nrc }).pipe(timeout(3000)));
      const nombreMateria = materiaData?.nombre || materiaData?.nombre_materia || 'Materia';

      await firstValueFrom(
        this.notificacionesService.SendActualizacion({
          matricula: matricula,
          nombreAlumno: nombreAlumno,
          nombreMateria: nombreMateria,
          emailDestino: emailAlumno,
          calificacionAnterior: Number(notaAnterior), // 🔥 Usamos la nota congelada
          calificacion_anterior: Number(notaAnterior),
          calificacionNueva: Number(nuevaNota),
          calificacion_nueva: Number(nuevaNota),
          nuevaNota: Number(nuevaNota),
          nueva_nota: Number(nuevaNota),
          tipoCalificacion: tipo_calificacion,
          tipo_calificacion: tipo_calificacion
        } as any).pipe(timeout(3000))
      );
      console.log(`✅ Notificación de actualización enviada a ${emailAlumno} de ${notaAnterior} a ${nuevaNota}`);
    } catch (error) {
      console.error('❌ Error silencioso:', (error as Error).message);
    }
  }

  private async enviarNotificacionBaja(matricula: string, matNombre: string, tipo_calificacion: string) {
    try {
      console.log('ENVIANDO A ALUMNOS (Baja) - matricula:', matricula);
      const alumnoData = await firstValueFrom(
        this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000))
      );
      
      const userId = alumnoData?.userId || alumnoData?.user_id || alumnoData?.['user_id'];
      
      if (!userId) {
        console.log('⚠️ Notificación abortada: ms-alumnos no devolvió un user_id válido.');
        return;
      }

      console.log('🔍 Consultando a Auth con userId:', userId);
      const userData = await firstValueFrom(
        this.authService.GetUserById({ user_id: userId, userId: userId } as any).pipe(timeout(3000))
      );
      console.log('🔐 DATA CRUDA DE AUTH:', JSON.stringify(userData, null, 2));

      const nombreAlumno = userData?.name || userData?.nombre || userData?.nombre_usuario || 'Estudiante';
      const emailAlumno = userData?.email || userData?.correo || 'sin-email@buap.mx';

      await firstValueFrom(
        this.notificacionesService.SendBajaNotif({
          matricula: matricula,
          nombreAlumno: nombreAlumno,
          nombreMateria: matNombre,
          emailDestino: emailAlumno,
          tipoCalificacion: tipo_calificacion 
        }).pipe(timeout(3000))
      );
      console.log(`✅ Notificación de baja enviada a ${emailAlumno}`);
    } catch (error) {
      console.error('❌ Error silencioso en notificación de baja:', (error as Error).message);
    }
  }

  private async enviarNotificacionRegistro(matricula: string, calificacion: Calificacion, nrc: string, tipo_calificacion: string) {
    try {
      console.log('ENVIANDO A ALUMNOS (Registro) - matricula:', matricula);
      
      const alumnoData = await firstValueFrom(
        this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000))
      );
      
      console.log('🛑 DATA CRUDA RECIBIDA DE gRPC:', JSON.stringify(alumnoData, null, 2));
      
      const userId = alumnoData?.userId || alumnoData?.user_id || alumnoData?.['user_id'];

      if (!userId) {
        console.log('⚠️ Notificación abortada: ms-alumnos no devolvió un user_id válido.');
        return;
      }

      console.log('🔍 Consultando a Auth con userId:', userId);
      const userData = await firstValueFrom(
        this.authService.GetUserById({ user_id: userId, userId: userId } as any).pipe(timeout(3000))
      );
      console.log('🔐 DATA CRUDA DE AUTH:', JSON.stringify(userData, null, 2));

      const nombreAlumno = userData?.name || userData?.nombre || userData?.nombre_usuario || 'Estudiante';
      const emailAlumno = userData?.email || userData?.correo || 'sin-email@buap.mx';

      const materiaData = await firstValueFrom(
        this.periodosService.GetMateriaById({ nrc }).pipe(timeout(3000))
      );
      const nombreMateria = materiaData?.nombre || materiaData?.nombre_materia || 'Materia';

      await firstValueFrom(
        this.notificacionesService.SendActualizacion({
          matricula: matricula,
          nombreAlumno: nombreAlumno,
          nombreMateria: nombreMateria,
          emailDestino: emailAlumno,
          calificacionAnterior: 0, 
          calificacionNueva: calificacion.calificacion_ordinaria, 
          tipoCalificacion: tipo_calificacion 
        }).pipe(timeout(3000))
      );
      console.log(`✅ Notificación de registro enviada a ${emailAlumno}`);
    } catch (error) {
      console.error('❌ Error silencioso en notificación de registro:', (error as Error).message);
    }
  }

  // ==========================================
  // 📊 PONDERACIONES (Examen %, Tarea %, Proyecto %)
  // ==========================================

  /**
   * ✅ POST /ponderaciones/:materiaId
   * Crear ponderación (admin, docente)
   */
  @Post('ponderaciones/:materiaId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async crearPonderacion(@Param('materiaId') materiaId: string, @Body() dto: CreatePonderacionDto) {
    validatePonderacionSum(dto);
    const existe = await this.ponderacionRepository.findOne({ where: { materia_clave: materiaId } });
    if (existe) {
      existe.examen_porcentaje = dto.examen_porcentaje;
      existe.tarea_porcentaje = dto.tarea_porcentaje;
      existe.proyecto_porcentaje = dto.proyecto_porcentaje;
      return await this.ponderacionRepository.save(existe);
    }
    return await this.ponderacionRepository.save(
      this.ponderacionRepository.create({ ...dto, materia_clave: materiaId })
    );
  }

  /**
   * ✅ GET /ponderaciones/:materiaId
   * Obtener ponderación (público)
   */
  @Get('ponderaciones/:materiaId')
  async obtenerPonderacion(@Param('materiaId') materiaId: string) {
    const ponderacion = await this.ponderacionRepository.findOne({ where: { materia_clave: materiaId } });
    if (!ponderacion) {
      return {
        examen_porcentaje: 40,
        tarea_porcentaje: 30,
        proyecto_porcentaje: 30,
      };
    }
    return ponderacion;
  }

  /**
   * ✅ PUT /ponderaciones/:id
   * Actualizar ponderación (admin, docente)
   */
  @Put('ponderaciones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async actualizarPonderacion(@Param('id') id: string, @Body() dto: UpdatePonderacionDto) {
    const ponderacion = await this.ponderacionRepository.findOne({ where: { id } });
    if (!ponderacion) throw new NotFoundException('Ponderación no encontrada');
    
    if (dto.examen_porcentaje !== undefined) ponderacion.examen_porcentaje = dto.examen_porcentaje;
    if (dto.tarea_porcentaje !== undefined) ponderacion.tarea_porcentaje = dto.tarea_porcentaje;
    if (dto.proyecto_porcentaje !== undefined) ponderacion.proyecto_porcentaje = dto.proyecto_porcentaje;
    
    validatePonderacionSum(ponderacion);
    return await this.ponderacionRepository.save(ponderacion);
  }

  // ==========================================
  // 📝 ACTIVIDADES (Examen Parcial 1, Tarea 1, etc.)
  // ==========================================

  /**
   * ✅ POST /actividades/:nrc
   * Crear actividad (admin, docente)
   */
  @Post('actividades/:nrc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async crearActividad(@Param('nrc') nrc: string, @Body() dto: CreateActividadDto) {
    const grupo = await this.grupoRepository.findOne({ where: { nrc } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    
    const actividadExistente = await this.actividadRepository.findOne({
      where: { nrc_grupo: nrc, nombre: dto.nombre, tipo: dto.tipo }
    });
    
    if (actividadExistente) {
      throw new BadRequestException(
        `Actividad "${dto.nombre}" de tipo "${dto.tipo}" ya existe en este grupo. Use PUT para actualizar.`
      );
    }
    
    return await this.actividadRepository.save(
      this.actividadRepository.create({ ...dto, nrc_grupo: nrc })
    );
  }

  /**
   * ✅ GET /actividades/:nrc
   * Listar actividades de un grupo (público)
   */
  @Get('actividades/:nrc')
  async obtenerActividades(@Param('nrc') nrc: string) {
    return await this.actividadRepository.find({ 
      where: { nrc_grupo: nrc, activo: true },
      order: { created_at: 'DESC' }
    });
  }

  /**
   * ✅ PUT /actividades/:id
   * Actualizar actividad (admin, docente)
   */
  @Put('actividades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async actualizarActividad(@Param('id') id: string, @Body() dto: UpdateActividadDto) {
    const actividad = await this.actividadRepository.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    
    Object.assign(actividad, dto);
    return await this.actividadRepository.save(actividad);
  }

  /**
   * ✅ DELETE /actividades/:id
   * Desactivar actividad (admin, docente)
   */
  @Delete('actividades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async desactivarActividad(@Param('id') id: string) {
    const actividad = await this.actividadRepository.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    
    actividad.activo = false;
    await this.actividadRepository.save(actividad);
    return { message: 'Actividad desactivada' };
  }

  // ==========================================
  // 📊 CONCENTRADO DE CALIFICACIONES
  // ==========================================

  /**
   * ✅ GET /concentrado/:nrc
   * Obtener reporte de calificaciones ponderadas (docente, admin)
   */
  @Get('concentrado/:nrc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async obtenerConcentrado(@Param('nrc') nrc: string) {
    const grupo = await this.grupoRepository.findOne({ 
      where: { nrc }, 
      relations: ['materia'] 
    });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const ponderacion = await this.ponderacionRepository.findOne({ 
      where: { materia_clave: grupo.materia.clave } 
    }) || {
      examen_porcentaje: 40,
      tarea_porcentaje: 30,
      proyecto_porcentaje: 30,
    };

    const calificaciones = await this.calificacionRepository.find({
      where: { nrc_grupo: nrc },
      relations: ['grupo', 'grupo.materia'],
    });

    const calificacionesProcessadas = await Promise.all(
      calificaciones.map(async (cal) => {
        let nombreEstudiante = 'Sin nombre';
        try {
          const alumnoData = await firstValueFrom(
            this.alumnosService.GetAlumnoByMatricula({ matricula: cal.matricula_alumno }).pipe(timeout(2000))
          );
          
          const userId = alumnoData?.userId || alumnoData?.user_id;
          if (userId) {
             const authData = await firstValueFrom(this.authService.GetUserById({ user_id: userId, userId: userId } as any).pipe(timeout(2000)));
             nombreEstudiante = authData?.name || authData?.nombre || 'Estudiante';
          }
        } catch {
          // Si falla, se queda el valor por defecto
        }

        const calificacionesPorTipo = await this.calificacionRepository.find({
          where: { matricula_alumno: cal.matricula_alumno, nrc_grupo: nrc },
        });

        const examenCal = calificacionesPorTipo.find(c => c.tipo_calificacion === 'examen')?.calificacion_ordinaria || 0;
        const tareaCal = calificacionesPorTipo.find(c => c.tipo_calificacion === 'tarea')?.calificacion_ordinaria || 0;
        const proyectoCal = calificacionesPorTipo.find(c => c.tipo_calificacion === 'proyecto')?.calificacion_ordinaria || 0;

        const promedioPonderado = (examenCal * ponderacion.examen_porcentaje / 100) +
                                 (tareaCal * ponderacion.tarea_porcentaje / 100) +
                                 (proyectoCal * ponderacion.proyecto_porcentaje / 100);

        return {
          matricula: cal.matricula_alumno,
          nombre_estudiante: nombreEstudiante,
          calificacion_examen: examenCal,
          calificacion_tarea: tareaCal,
          calificacion_proyecto: proyectoCal,
          promedio_ponderado: Math.round(promedioPonderado * 100) / 100,
          estatus: promedioPonderado >= 6 ? 'Aprobado' : 'Reprobado',
        };
      })
    );

    const sinDuplicados = Array.from(
      new Map(calificacionesProcessadas.map(c => [c.matricula, c])).values()
    );

    return {
      nrc_grupo: nrc,
      materia: {
        clave: grupo.materia.clave,
        nombre: grupo.materia.nombre,
      },
      periodo: grupo.periodo,
      total_estudiantes: sinDuplicados.length,
      calificaciones: sinDuplicados,
      ponderaciones: {
        examen: ponderacion.examen_porcentaje,
        tarea: ponderacion.tarea_porcentaje,
        proyecto: ponderacion.proyecto_porcentaje,
      },
    };
  }

  /**
   * 📨 Consumidor: Alumno se inscribió a una materia
   * Se ejecuta automáticamente cuando llega el evento desde RabbitMQ
   */
  async onAlumnoInscrito(event: AlumnoInscritoEvent) {
    try {
      this.logger.log(
        `📨 Evento recibido: Alumno ${event.matricula} inscrito a ${event.nrc_materia}`
      );

      // Crear calificación inicial para el alumno
      const calificacion = this.calificacionRepository.create({
        matricula_alumno: event.matricula,
        nrc_grupo: event.nrc_materia,
        nrc_materia: event.nrc_materia
      });

      await this.calificacionRepository.save(calificacion);

      this.logger.log(
        `✅ Calificación inicial creada para ${event.matricula} en NRC ${event.nrc_materia}`
      );
    } catch (error) {
      this.logger.error('❌ Error procesando evento alumno.inscrito:', error);
    }
  }

  /**
   * 📨 Consumidor: Se calculó el resumen de asistencia
   * Se ejecuta automáticamente cuando llega el evento desde RabbitMQ
   */
  async onAsistenciaResumenCalculado(event: AsistenciaResumenCalculadoEvent) {
    try {
      this.logger.log(
        `📨 Evento recibido: Resumen asistencia para ${event.matricula} en ${event.nrc_materia}`
      );

      // Aquí se puede actualizar el estado de derecho a proyecto
      // o aplicar restricciones basadas en asistencia

      this.logger.log(
        `✅ Resumen de asistencia procesado para ${event.matricula}`
      );
    } catch (error) {
      this.logger.error('❌ Error procesando evento asistencia.resumen.calculado:', error);
    }
  }
}