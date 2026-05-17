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
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, Observable, timeout } from 'rxjs';

import { Materia } from './materia.entity';
import { Grupo } from './grupo.entity';
import { Calificacion } from './calificacion.entity';
import {
  CreateMateriaDto,
  CreateGrupoDto,
  CreateCalificacionDto,
  UpdateCalificacionDto,
} from './dtos';
import { JwtAuthGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: { user_id: string; email: string; role: 'admin' | 'docente' | 'alumno' };
}

interface AlumnosServiceClient {
  GetAlumnoByMatricula(data: { matricula: string }): Observable<any>;
  GetAlumnoByUserId(data: { user_id: string }): Observable<any>;
}

interface AuthServiceClient {
  GetUserById(data: { user_id: string }): Observable<any>;
}

interface NotificacionesServiceClient {
  SendBienvenida(data: any): Observable<any>;
  SendBajaNotif(data: any): Observable<any>;
  SendActualizacion(data: any): Observable<any>;
}

interface PeriodosServiceClient {
  GetMateriaById(data: { materia_id: string }): Observable<any>;
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
    const materia = await this.materiaRepository.findOne({ where: { clave: dto.materia_clave } });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    return await this.grupoRepository.save(this.grupoRepository.create({
      nrc: dto.nrc, materia, docente_id: req.user.user_id, seccion: dto.seccion, periodo: dto.periodo,
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
    // 🚀 LLAMADA gRPC AL MS-2 (PERIODOS) PARA VALIDAR LA MATERIA
    try {
      const materiaInfo = await firstValueFrom(
        this.periodosService.GetMateriaById({ materia_id: dto.nrc_grupo }).pipe(timeout(5000))
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

    // Si la validación pasó, proceder con la calificación
    const grupo = await this.grupoRepository.findOne({
      where: { nrc: dto.nrc_grupo },
      relations: ['materia'],
    });
    if (!grupo) throw new NotFoundException('El grupo no existe.');

    const estatus =
      dto.calificacion_ordinaria >= 6 ? 'Aprobado' : 'Reprobado';
    return await this.calificacionRepository.save(
      this.calificacionRepository.create({
        grupo,
        matricula_alumno: dto.matricula_alumno,
        calificacion_ordinaria: dto.calificacion_ordinaria,
        estatus,
      }),
    );
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

    calificacion.calificacion_ordinaria = dto.calificacion_ordinaria;
    calificacion.estatus = dto.calificacion_ordinaria >= 6 ? 'Aprobado' : 'Reprobado';
    const resultado = await this.calificacionRepository.save(calificacion);

    // Esperamos activamente a que se envíe el correo
    await this.enviarNotificacionActualizacion(matricula, calificacion, dto.calificacion_ordinaria, nrc);

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

    // Esperamos activamente a que se envíe el correo
    await this.enviarNotificacionBaja(matricula, matNombre);

    return { message: 'Alumno dado de baja exitosamente', matricula_alumno: matricula };
  }

  /**
   * ✅ GET /kardex/mi-kardex
   * Ver mi kardex (solo alumno autenticado)
   */
  @Get('kardex/mi-kardex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('alumno', 'docente', 'admin')
  async verMiKardex(@Req() req: AuthenticatedRequest) {
    const alumno = await firstValueFrom(this.alumnosService.GetAlumnoByUserId({ user_id: req.user.user_id }));
    return await this.calificacionRepository.find({ where: { matricula_alumno: alumno.matricula }, relations: ['grupo', 'grupo.materia'] });
  }

  // ==========================================
  // ✉️ MÉTODOS PRIVADOS PARA NOTIFICACIONES
  // ==========================================

  private async enviarNotificacionActualizacion(matricula: string, calificacion: Calificacion, nuevaNota: number, nrc: string) {
    try {
      // 🔍 Paso 1: Obtener datos del alumno desde MS-ALUMNOS
      const alumnoData = await firstValueFrom(
        this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000))
      );
      const nombreAlumno = alumnoData?.nombre_usuario || alumnoData?.nombreUsuario || 'Estudiante';
      const emailAlumno = alumnoData?.email_usuario || alumnoData?.emailUsuario || 'sin-email@buap.mx';
      console.log(`✅ Alumno obtenido: ${nombreAlumno} (${emailAlumno})`);

      // 🔍 Paso 2: Obtener datos de la materia desde MS-PERIODOS
      const materiaData = await firstValueFrom(
        this.periodosService.GetMateriaById({ materia_id: nrc }).pipe(timeout(3000))
      );
      const nombreMateria = materiaData?.nombre || materiaData?.nombre_materia || 'Materia';
      console.log(`✅ Materia obtenida: ${nombreMateria}`);

      // 📡 Paso 3: Enviar notificación con todos los datos
      await firstValueFrom(
        this.notificacionesService.SendActualizacion({
          matricula: matricula,
          nombreAlumno: nombreAlumno,
          nombreMateria: nombreMateria,
          emailDestino: emailAlumno,
          calificacion_anterior: calificacion.calificacion_ordinaria,
          calificacion_nueva: nuevaNota
        }).pipe(timeout(3000))
      );
      console.log(`✅ Notificación de actualización enviada para ${matricula}`);
    } catch (error) {
      console.error('❌ Error enviando notificación de actualización (gRPC):', (error as Error).message);
    }
  }

  private async enviarNotificacionBaja(matricula: string, matNombre: string) {
    try {
      // 🔍 Paso 1: Obtener datos del alumno desde MS-ALUMNOS
      const alumnoData = await firstValueFrom(
        this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000))
      );
      const nombreAlumno = alumnoData?.nombre_usuario || alumnoData?.nombreUsuario || 'Estudiante';
      const emailAlumno = alumnoData?.email_usuario || alumnoData?.emailUsuario || 'sin-email@buap.mx';
      console.log(`✅ Alumno obtenido para baja: ${nombreAlumno} (${emailAlumno})`);

      // 📡 Paso 2: Enviar notificación de baja con todos los datos
      await firstValueFrom(
        this.notificacionesService.SendBajaNotif({
          matricula: matricula,
          nombreAlumno: nombreAlumno,
          nombreMateria: matNombre,
          emailDestino: emailAlumno
        }).pipe(timeout(3000))
      );
      console.log(`✅ Notificación de baja enviada para ${matricula}`);
    } catch (error) {
      console.error('❌ Error enviando notificación de baja (gRPC):', (error as Error).message);
    }
  }
} // 👈 AQUÍ ESTÁ LA LLAVE QUE FALTABA