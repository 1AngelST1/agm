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
  UnauthorizedException,
  Inject,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
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

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: 'admin' | 'docente' | 'alumno' };
}

interface AlumnosServiceClient {
  GetAlumnoByMatricula(data: { matricula: string }): Observable<any>;
  GetAlumnoByUserId(data: { user_id: string }): Observable<any>;
}

interface AuthServiceClient {
  GetUserById(data: { user_id: string }): Observable<any>;
}

interface NotificacionesServiceClient {
  SendBajaNotif(data: any): Observable<any>;
  SendActualizacion(data: any): Observable<any>;
}

@Controller('calificaciones')
@UseGuards(AuthGuard('jwt'))
export class AppController implements OnModuleInit {
  private authService!: AuthServiceClient;
  private alumnosService!: AlumnosServiceClient;
  private notificacionesService!: NotificacionesServiceClient;

  constructor(
    @InjectRepository(Materia) private materiaRepository: Repository<Materia>,
    @InjectRepository(Grupo) private grupoRepository: Repository<Grupo>,
    @InjectRepository(Calificacion) private calificacionRepository: Repository<Calificacion>,
    @Inject('AUTH_PACKAGE') private authClient: ClientGrpc,
    @Inject('ALUMNOS_PACKAGE') private alumnosClient: ClientGrpc,
    @Inject('NOTIFICACIONES_PACKAGE') private notificacionesClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>('AuthService');
    this.alumnosService = this.alumnosClient.getService<AlumnosServiceClient>('AlumnosService');
    this.notificacionesService = this.notificacionesClient.getService<NotificacionesServiceClient>('NotificacionesService');
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
  async crearGrupo(@Body() dto: CreateGrupoDto, @Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'admin' && req.user.role !== 'docente') throw new UnauthorizedException();
    const materia = await this.materiaRepository.findOne({ where: { clave: dto.materia_clave } });
    if (!materia) throw new NotFoundException('Materia no encontrada');
    return await this.grupoRepository.save(this.grupoRepository.create({
      nrc: dto.nrc, materia, docente_id: req.user.userId, seccion: dto.seccion, periodo: dto.periodo,
    }));
  }

  @Post('calificar')
  async calificarAlumno(@Body() dto: CreateCalificacionDto, @Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'admin' && req.user.role !== 'docente') throw new UnauthorizedException();
    const grupo = await this.grupoRepository.findOne({ where: { nrc: dto.nrc_grupo }, relations: ['materia'] });
    if (!grupo) throw new NotFoundException('El grupo no existe.');

    const estatus = dto.calificacion_ordinaria >= 6 ? 'Aprobado' : 'Reprobado';
    return await this.calificacionRepository.save(this.calificacionRepository.create({
      grupo, matricula_alumno: dto.matricula_alumno, calificacion_ordinaria: dto.calificacion_ordinaria, estatus,
    }));
  }

  @Put(':nrc/:matricula')
  async actualizarCalificacion(@Param('nrc') nrc: string, @Param('matricula') matricula: string, @Body() dto: UpdateCalificacionDto, @Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'admin' && req.user.role !== 'docente') throw new UnauthorizedException();
    
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

  private async enviarNotificacionActualizacion(matricula: string, calificacion: any, nuevaNota: number, nrc: string) {
    try {
      // 1. TU CORREO SIEMPRE COMO RESPALDO POR SI FALLAN LOS OTROS MICROSERVICIOS
      let email = 'angel.sarmientot@alumno.buap.mx'; 
      
      // 🛠️ AQUÍ ESTÁ EL CAMBIO: Concatenamos Clave + Nombre de la materia
      const nombreMateria = calificacion.grupo?.materia 
        ? `${calificacion.grupo.materia.clave} - ${calificacion.grupo.materia.nombre}` 
        : nrc;

      try {
        const alumnoData = await firstValueFrom(this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000)));
        const userData = await firstValueFrom(this.authService.GetUserById({ user_id: alumnoData.user_id }).pipe(timeout(3000)));
        if (userData?.email) email = userData.email;
      } catch (err: any) {
        console.warn(`⚠️ Aviso: Se usará el correo por defecto. Error al buscar alumno: ${err.message}`);
      }

      console.log(`🚀 Preparando paquete gRPC Actualización -> Matrícula: ${matricula}, Materia: ${nombreMateria}`);

      // 2. FORZAMOS EL ENVÍO Y ESPERAMOS RESPUESTA
      const response = await firstValueFrom(this.notificacionesService.SendActualizacion({
        email_destino: email,
        emailDestino: email,
        usuario_id: matricula,
        usuarioId: matricula,
        materia_id: nombreMateria,
        materiaId: nombreMateria,
        nueva_nota: nuevaNota,
        nuevaNota: nuevaNota
      } as any));

      console.log(`✅ gRPC Actualización disparada correctamente:`, response);
    } catch (err: any) {
      console.error('❌ ERROR GRAVE al enviar gRPC Actualización:', err.message);
    }
  }

  @Delete(':nrc/:matricula')
  async eliminarCalificacion(@Param('nrc') nrc: string, @Param('matricula') matricula: string, @Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'admin' && req.user.role !== 'docente') throw new UnauthorizedException();
    
    const calificacion = await this.calificacionRepository.findOne({ 
      where: { matricula_alumno: matricula, nrc_grupo: nrc }, 
      relations: ['grupo', 'grupo.materia'] 
    });

    if (!calificacion) throw new NotFoundException('No existe el registro');
    
    // 🛠️ AQUÍ ESTÁ EL CAMBIO: Concatenamos Clave + Nombre de la materia
    const matNombre = calificacion.grupo?.materia 
      ? `${calificacion.grupo.materia.clave} - ${calificacion.grupo.materia.nombre}` 
      : nrc;
    
    await this.calificacionRepository.remove(calificacion);

    // Esperamos activamente a que se envíe el correo
    await this.enviarNotificacionBaja(matricula, matNombre);

    return { message: 'Alumno dado de baja exitosamente', matricula_alumno: matricula };
  }

  private async enviarNotificacionBaja(matricula: string, nombreMateria: string) {
    try {
      // 1. TU CORREO SIEMPRE COMO RESPALDO
      let email = 'angel.sarmientot@alumno.buap.mx';

      try {
        const alumnoData = await firstValueFrom(this.alumnosService.GetAlumnoByMatricula({ matricula }).pipe(timeout(3000)));
        const userData = await firstValueFrom(this.authService.GetUserById({ user_id: alumnoData.user_id }).pipe(timeout(3000)));
        if (userData?.email) email = userData.email;
      } catch (err: any) {
        console.warn(`⚠️ Aviso: Se usará el correo por defecto. Error al buscar alumno: ${err.message}`);
      }

      console.log(`🚀 Preparando paquete gRPC Baja -> Matrícula: ${matricula}, Materia: ${nombreMateria}`);

      // 2. FORZAMOS EL ENVÍO Y ESPERAMOS RESPUESTA
      const response = await firstValueFrom(this.notificacionesService.SendBajaNotif({
        email_destino: email,
        emailDestino: email,
        usuario_id: matricula,
        usuarioId: matricula,
        materia_id: nombreMateria,
        materiaId: nombreMateria
      } as any));

      console.log(`✅ gRPC Baja disparada correctamente:`, response);
    } catch (err: any) {
      console.error('❌ ERROR GRAVE al enviar gRPC Baja:', err.message);
    }
  }

  @Get('kardex/mi-kardex')
  async verMiKardex(@Req() req: AuthenticatedRequest) {
    const alumno = await firstValueFrom(this.alumnosService.GetAlumnoByUserId({ user_id: req.user.userId }));
    return await this.calificacionRepository.find({ where: { matricula_alumno: alumno.matricula }, relations: ['grupo', 'grupo.materia'] });
  }
}