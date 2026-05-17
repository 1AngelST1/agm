import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { GenerarQrDto, RegistrarAsistenciaDto } from './dtos';
import { JwtAuthGrpcGuard } from './guards/jwt-auth-grpc.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('asistencias')
@UseGuards(JwtAuthGrpcGuard, RolesGuard) // 🛡️ Protegemos TODO el controlador
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('generar-qr')
  @Roles('docente') // 👨‍🏫 Solo los maestros pueden generar QRs
  generarQr(@Body() generarQrDto: GenerarQrDto) {
    return this.appService.generarQrDocente(generarQrDto.nrc_materia);
  }

  @Post('registrar')
  @Roles('alumno') // 🧑‍🎓 Solo los alumnos pueden escanearlos
  registrarAsistencia(@Body() registrarAsistenciaDto: RegistrarAsistenciaDto) {
    return this.appService.registrarAsistenciaAlumno(
      registrarAsistenciaDto.matricula_alumno,
      registrarAsistenciaDto.token_qr,
    );
  }
}
