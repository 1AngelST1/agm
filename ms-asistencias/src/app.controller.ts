import {
  Controller,
  Post,
  Body,
  UseGuards,
  Inject,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  Get,
  Param,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, timeout, firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import { AppService } from './app.service';
import { GenerarQrDto, RegistrarAsistenciaDto } from './dtos';
import { JwtAuthGrpcGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Asistencia } from './asistencia.entity';
import { SesionAsistencia } from './sesion-asistencia.entity';

interface AlumnosServiceClient {
  GetAlumnoByMatricula(data: { matricula: string }): Observable<any>;
}

@Controller('asistencias')
@UseGuards(JwtAuthGrpcGuard, RolesGuard)
export class AppController implements OnModuleInit {
  private alumnosService!: AlumnosServiceClient;

  constructor(
    private readonly appService: AppService,
    @Inject('ALUMNOS_SERVICE') private alumnosClient: ClientGrpc,
    @InjectRepository(Asistencia)
    private asistenciaRepository: Repository<Asistencia>,
    @InjectRepository(SesionAsistencia)
    private sesionRepository: Repository<SesionAsistencia>,
  ) {}

  onModuleInit() {
    this.alumnosService = this.alumnosClient.getService<AlumnosServiceClient>('AlumnosService');
  }

  // ==========================================
  // 📡 MÉTODOS gRPC
  // ==========================================

  /**
   * Crear una sesión de asistencia (profesor abre la clase)
   */
  @GrpcMethod('AsistenciasService', 'CrearSesion')
  async crearSesion(data: { profesor_id: string; nrc: string; duracion_minutos: number }) {
    console.log(`📡 [gRPC] Creando sesión de asistencia para NRC: ${data.nrc}`);

    const codigo_sesion = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    const sesion = this.sesionRepository.create({
      profesor_id: data.profesor_id,
      nrc: data.nrc,
      codigo_sesion: codigo_sesion,
      duracion_minutos: data.duracion_minutos,
      estado: 'abierta',
    });

    const sesionGuardada = await this.sesionRepository.save(sesion);

    return {
      sesion_id: sesionGuardada.id,
      codigo_sesion: sesionGuardada.codigo_sesion,
      nrc: sesionGuardada.nrc,
      timestamp_inicio: sesionGuardada.fecha_inicio.getTime(),
      duracion_minutos: sesionGuardada.duracion_minutos,
      estado: sesionGuardada.estado,
    };
  }

  /**
   * Generar QR del alumno para una sesión
   */
  @GrpcMethod('AsistenciasService', 'GenerarQRAlumno')
  async generarQRAlumno(data: { matricula: string; sesion_id: string }) {
    console.log(`📡 [gRPC] Generando QR para alumno: ${data.matricula}`);

    // Validar que la sesión existe y está abierta
    const sesion = await this.sesionRepository.findOne({
      where: { id: data.sesion_id, estado: 'abierta' },
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión ${data.sesion_id} no encontrada o cerrada`);
    }

    // Validar que el alumno existe
    try {
      await firstValueFrom(
        this.alumnosService.GetAlumnoByMatricula({ matricula: data.matricula }).pipe(timeout(2000))
      );
    } catch {
      throw new BadRequestException(`Alumno con matrícula ${data.matricula} no encontrado`);
    }

    // Crear hash del QR: matricula|sesion_id|timestamp
    const qr_data = `${data.matricula}|${data.sesion_id}|${Date.now()}`;
    const qr_hash = crypto.createHash('sha256').update(qr_data).digest('hex');

    return {
      qr_code: qr_hash,
      qr_data: qr_data,
      sesion_id: data.sesion_id,
      matricula: data.matricula,
      timestamp_generacion: Date.now(),
      valido: true,
    };
  }

  /**
   * Validar asistencia (profesor escanea el QR del alumno)
   */
  @GrpcMethod('AsistenciasService', 'ValidarAsistencia')
  async validarAsistencia(data: { sesion_id: string; qr_data: string; tipo: string }) {
    console.log(`📡 [gRPC] Validando asistencia`);

    // 1. Validar que la sesión existe y está abierta
    const sesion = await this.sesionRepository.findOne({
      where: { id: data.sesion_id, estado: 'abierta' },
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión ${data.sesion_id} no encontrada o cerrada`);
    }

    // 2. Validar que no ha expirado la sesión
    const ahora = new Date();
    const minutosTranscurridos =
      (ahora.getTime() - sesion.fecha_inicio.getTime()) / (1000 * 60);

    if (minutosTranscurridos > sesion.duracion_minutos) {
      throw new BadRequestException(
        `Sesión expirada. Duración: ${sesion.duracion_minutos} minutos`
      );
    }

    // 3. Extraer matrícula del QR data
    const partes = data.qr_data.split('|');
    if (partes.length < 2) {
      throw new BadRequestException('Formato de QR inválido');
    }

    const matricula = partes[0];

    // 4. Validar que no tenga asistencia duplicada en esta sesión
    const yaRegistrado = await this.asistenciaRepository.findOne({
      where: {
        sesion_id: data.sesion_id,
        matricula_alumno: matricula,
      },
    });

    if (yaRegistrado) {
      throw new BadRequestException(
        `Alumno ${matricula} ya registrado en esta sesión`
      );
    }

    // 5. Crear registro de asistencia
    const asistencia = this.asistenciaRepository.create({
      sesion_id: data.sesion_id,
      matricula_alumno: matricula,
      nrc_materia: sesion.nrc,
      estado: data.tipo || 'presente',
      qr_validado: true,
    });

    const asistenciaGuardada = await this.asistenciaRepository.save(asistencia);

    return {
      success: true,
      message: `Asistencia registrada para ${matricula}`,
      asistencia_id: asistenciaGuardada.id,
      matricula: matricula,
      tipo: asistenciaGuardada.estado,
      timestamp_registro: asistenciaGuardada.fecha_registro.getTime(),
    };
  }

  /**
   * Obtener asistencias del alumno
   */
  @GrpcMethod('AsistenciasService', 'GetAsistenciasByAlumno')
  async getAsistenciasByAlumno(data: { matricula: string; nrc: string }) {
    console.log(`📡 [gRPC] Obteniendo asistencias para ${data.matricula}`);

    const asistencias = await this.asistenciaRepository.find({
      where: {
        matricula_alumno: data.matricula,
        nrc_materia: data.nrc,
      },
    });

    const presentes = asistencias.filter((a) => a.estado === 'presente').length;
    const retardos = asistencias.filter((a) => a.estado === 'retardo').length;
    const faltas = asistencias.filter((a) => a.estado === 'falta').length;
    const total = asistencias.length;
    const porcentaje = total > 0 ? (presentes / total) * 100 : 0;

    return {
      total_asistencias: presentes,
      total_faltas: faltas,
      total_retardos: retardos,
      porcentaje_asistencia: Number(porcentaje.toFixed(2)),
      asistencias: asistencias.map((a) => ({
        fecha: a.fecha_registro.getTime(),
        tipo: a.estado,
        clase: a.nrc_materia,
      })),
    };
  }

  /**
   * Cerrar sesión de asistencia
   */
  @GrpcMethod('AsistenciasService', 'CerrarSesion')
  async cerrarSesion(data: { sesion_id: string }) {
    console.log(`📡 [gRPC] Cerrando sesión: ${data.sesion_id}`);

    const sesion = await this.sesionRepository.findOne({
      where: { id: data.sesion_id },
    });

    if (!sesion) {
      throw new NotFoundException(`Sesión ${data.sesion_id} no encontrada`);
    }

    sesion.estado = 'cerrada';
    sesion.fecha_cierre = new Date();
    await this.sesionRepository.save(sesion);

    // Contar asistencias registradas
    const totalAsistencias = await this.asistenciaRepository.count({
      where: { sesion_id: data.sesion_id },
    });

    return {
      success: true,
      message: `Sesión cerrada`,
      total_asistencias_registradas: totalAsistencias,
    };
  }

  // ==========================================
  // 🌐 ENDPOINTS REST (Opcional, para UI)
  // ==========================================

  @Post('generar-qr')
  @Roles('docente')
  generarQr(@Body() generarQrDto: GenerarQrDto) {
    return this.appService.generarQrDocente(generarQrDto.nrc_materia);
  }

  @Post('registrar')
  @Roles('alumno')
  registrarAsistencia(@Body() registrarAsistenciaDto: RegistrarAsistenciaDto) {
    return this.appService.registrarAsistenciaAlumno(
      registrarAsistenciaDto.matricula_alumno,
      registrarAsistenciaDto.token_qr,
    );
  }
}

