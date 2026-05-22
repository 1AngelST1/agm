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
} from '@nestjs/common';
import { Request } from 'express';
import { GrpcMethod } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, Observable, timeout } from 'rxjs';

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
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>('AuthService');
    this.alumnosService = this.alumnosClient.getService<AlumnosServiceClient>('AlumnosService');
    this.notificacionesService = this.notificacionesClient.getService<NotificacionesServiceClient>('NotificacionesService');
    this.periodosService = this.periodosClient.getService<PeriodosServiceClient>('PeriodosService');
  }

  @Get()
  getHello() {
    return { message: 'ms-calificaciones activo en puerto 3003' };
  }

  @Get('materias')
  async obtenerMaterias() {
    return await this.materiaRepository.find();
  }

  @Post('materia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async crearMateria(@Body() dto: CreateMateriaDto) {
    const existe = await this.materiaRepository.findOne({ where: { clave: dto.clave } });
    if (existe) throw new BadRequestException(`Ya existe la clave ${dto.clave}`);
    return await this.materiaRepository.save(this.materiaRepository.create(dto));
  }

  @Get('grupos')
  async obtenerGrupos() {
    return await this.grupoRepository.find({ relations: ['materia'] });
  }

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

  @Post('calificar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async calificarAlumno(
    @Body() dto: CreateCalificacionDto,
  ) {
    const calificacionExistente = await this.calificacionRepository.findOne({
      where: { nrc_grupo: dto.nrc_grupo, matricula_alumno: dto.matricula_alumno, actividad_id: dto.actividad_id }
    });
    if (calificacionExistente) {
      throw new BadRequestException(
        `Ya existe una calificación para el alumno ${dto.matricula_alumno} en esta actividad. Use PUT para actualizar.`
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

  @Put(':nrc/:matricula')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async actualizarCalificacion(@Param('nrc') nrc: string, @Param('matricula') matricula: string, @Body() dto: UpdateCalificacionDto) {
    // Si manejas actividades, aquí deberías buscar también por actividad_id si viene en el DTO
    const calificacion = await this.calificacionRepository.findOne({ 
      where: { matricula_alumno: matricula, nrc_grupo: nrc }, 
      relations: ['grupo', 'grupo.materia'] 
    });
    
    if (!calificacion) throw new NotFoundException('Registro no encontrado');

    const notaAnterior = calificacion.calificacion_ordinaria;

    calificacion.calificacion_ordinaria = dto.calificacion_ordinaria;
    calificacion.estatus = dto.calificacion_ordinaria >= 6 ? 'Aprobado' : 'Reprobado';
    const resultado = await this.calificacionRepository.save(calificacion);

    await this.enviarNotificacionActualizacion(matricula, notaAnterior, dto.calificacion_ordinaria, nrc, calificacion.tipo_calificacion || 'ordinaria');

    return resultado;
  }

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
          calificacionAnterior: Number(notaAnterior), 
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
      
      const userId = alumnoData?.userId || alumnoData?.user_id || alumnoData?.['user_id'];

      if (!userId) {
        console.log('⚠️ Notificación abortada: ms-alumnos no devolvió un user_id válido.');
        return;
      }

      const userData = await firstValueFrom(
        this.authService.GetUserById({ user_id: userId, userId: userId } as any).pipe(timeout(3000))
      );

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

  @Get('actividades/:nrc')
  async obtenerActividades(@Param('nrc') nrc: string) {
    return await this.actividadRepository.find({ 
      where: { nrc_grupo: nrc, activo: true },
      order: { created_at: 'DESC' }
    });
  }

  @Put('actividades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async actualizarActividad(@Param('id') id: string, @Body() dto: UpdateActividadDto) {
    const actividad = await this.actividadRepository.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException('Actividad no encontrada');
    
    Object.assign(actividad, dto);
    return await this.actividadRepository.save(actividad);
  }

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

        // 🔥 1. Separar por categorías
        const examenes = calificacionesPorTipo.filter(c => c.tipo_calificacion === 'examen');
        const tareas = calificacionesPorTipo.filter(c => c.tipo_calificacion === 'tarea');
        const proyectos = calificacionesPorTipo.filter(c => c.tipo_calificacion === 'proyecto');

        // 🔥 2. Función auxiliar para promediar (Si no hay, da 0)
        const promediar = (arr: Calificacion[]) => arr.length > 0 
          ? arr.reduce((sum, c) => sum + Number(c.calificacion_ordinaria), 0) / arr.length 
          : 0;

        // 🔥 3. Sacar el promedio real de cada categoría
        const examenNum = promediar(examenes);
        const tareaNum = promediar(tareas);
        const proyectoNum = promediar(proyectos);

        const promedioPonderado = (examenNum * Number(ponderacion.examen_porcentaje) / 100) +
                                  (tareaNum * Number(ponderacion.tarea_porcentaje) / 100) +
                                  (proyectoNum * Number(ponderacion.proyecto_porcentaje) / 100);

        return {
          matricula: cal.matricula_alumno,
          nombre_estudiante: nombreEstudiante,
          calificacion_examen: Number(examenNum.toFixed(2)),
          calificacion_tarea: Number(tareaNum.toFixed(2)),
          calificacion_proyecto: Number(proyectoNum.toFixed(2)),
          promedio_ponderado: Number((Math.round(promedioPonderado * 100) / 100).toFixed(2)),
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
        examen: Number(ponderacion.examen_porcentaje) || 0,
        tarea: Number(ponderacion.tarea_porcentaje) || 0,
        proyecto: Number(ponderacion.proyecto_porcentaje) || 0,
      },
    };
  }

  // ==========================================
  // 📡 MÉTODOS GRPC (Para comunicarse con ms-reportes)
  // ==========================================
  @GrpcMethod('CalificacionesService', 'GetConcentrado')
  async getConcentradoGrpc(data: { nrc: string }) {
    console.log(`📡 [gRPC] Solicitud de concentrado recibida para NRC: ${data.nrc}`);
    
    const resultado = await this.obtenerConcentrado(data.nrc);
    
    const respuestaFormato = {
      nrc_grupo: String(resultado.nrc_grupo),
      materia: {
        clave: String(resultado.materia.clave),
        nombre: String(resultado.materia.nombre),
      },
      periodo: String(resultado.periodo),
      total_estudiantes: Number(resultado.total_estudiantes),
      calificaciones: resultado.calificaciones.map((cal: any) => ({
        matricula: String(cal.matricula),
        nombre_estudiante: String(cal.nombre_estudiante),
        calificacion_examen: Number(cal.calificacion_examen),
        calificacion_tarea: Number(cal.calificacion_tarea),
        calificacion_proyecto: Number(cal.calificacion_proyecto),
        promedio_ponderado: Number(cal.promedio_ponderado),
        estatus: String(cal.estatus),
      })),
      ponderaciones: {
        examen: Number(resultado.ponderaciones.examen),
        tarea: Number(resultado.ponderaciones.tarea),
        proyecto: Number(resultado.ponderaciones.proyecto),
      },
    };
    
    return respuestaFormato;
  }
}