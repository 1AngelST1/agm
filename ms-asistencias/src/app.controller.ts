import { Controller, Post, Body } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './app.service';
import { GenerarQrDto, RegistrarAsistenciaDto } from './dtos';

@Controller('asistencias')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('generar-qr')
  async generarQr(@Body() dto: GenerarQrDto) {
    return this.appService.generarQrDocente(dto.nrc_materia);
  }

  @Post('registrar')
  async registrarAsistencia(@Body() dto: RegistrarAsistenciaDto) {
    return this.appService.registrarAsistenciaAlumno(
      dto.matricula_alumno,
      dto.token_qr,
    );
  }

  @GrpcMethod('AsistenciasService')
  async GetAsistenciasByAlumno(request: { matricula: string; nrc: string }) {
    // TODO: Obtener estadísticas reales de asistencias de la BD
    // Por ahora retorna valores por defecto
    return {
      total_asistencias: 0,
      total_faltas: 0,
    };
  }
}
