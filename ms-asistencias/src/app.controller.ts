import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { RabbitMQService } from './rabbitmq.service';
import { GenerarQrDto, RegistrarAsistenciaDto } from './dtos';
import { JwtAuthGrpcGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('asistencias')
@UseGuards(JwtAuthGrpcGuard, RolesGuard) // 🛡️ Protegemos TODO el controlador
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  @Post('generar-qr')
  @Roles('admin', 'docente') // 👨‍🏫 Solo los maestros pueden generar QRs
  generarQr(@Body() generarQrDto: GenerarQrDto) {
    return this.appService.generarQrDocente(generarQrDto.nrc_materia);
  }

  @Post('registrar')
  @Roles('admin', 'alumno') // 🧑‍🎓 Solo los alumnos pueden escanearlos
  registrarAsistencia(@Body() registrarAsistenciaDto: RegistrarAsistenciaDto) {
    return this.appService.registrarAsistenciaAlumno(
      registrarAsistenciaDto.matricula_alumno,
      registrarAsistenciaDto.token_qr,
      this.rabbitmqService,
    );
  }

  @Get('calcular-resumen/:nrc_materia')
  @Roles('admin', 'docente')
  async calcularResumen(@Param('nrc_materia') nrc_materia: string) {
    return this.appService.calcularResumenAsistencia(nrc_materia, this.rabbitmqService);
  }
}
