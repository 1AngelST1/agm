import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asistencia } from './asistencia.entity';
import { RabbitMQService } from './rabbitmq.service';
import { AlumnoInscritoEvent, AsistenciaRegistradaEvent, AsistenciaResumenCalculadoEvent, AlumnoSinDerechoProyectoEvent } from '@shared/events.types';
import { RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class AppService {
  private logger = new Logger('AsistenciasService');

  constructor(
    @InjectRepository(Asistencia)
    private asistenciaRepository: Repository<Asistencia>,
    @Inject('REDIS_CLIENT')
    private redisClient: Redis,
    private rabbitmqService: RabbitMQService,
  ) {}

  /**
   * 👨‍🏫 Método para el Docente: Genera el QR que expira
   */
  async generarQrDocente(nrc_materia: string) {
    const tokenUnico = crypto.randomBytes(16).toString('hex');

    // Guarda en Redis por 10 minutos (600 segundos)
    await this.redisClient.setex(
      `qr_asistencia:${tokenUnico}`,
      600,
      nrc_materia,
    );

    const qrData = JSON.stringify({ token: tokenUnico, nrc: nrc_materia });
    const qrImagenBase64 = await QRCode.toDataURL(qrData);

    return {
      mensaje: 'QR generado exitosamente. Válido por 10 minutos.',
      token: tokenUnico,
      qr_imagen: qrImagenBase64,
      expira_en_segundos: 600,
    };
  }

  /**
   * 🧑‍🎓 Método para el Alumno: Escanea y registra su asistencia
   */
  async registrarAsistenciaAlumno(matricula: string, token_qr: string, rabbitmqService?: RabbitMQService) {
    const nrc_materia = await this.redisClient.get(`qr_asistencia:${token_qr}`);

    if (!nrc_materia) {
      throw new BadRequestException(
        '¡Ups! Este código QR es inválido o ya expiró.',
      );
    }

    // 🛑 FILTRO ANTI-TRAMPAS: Verificar si ya se registró hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Seteamos la hora a las 00:00:00 del día actual

    const yaRegistrado = await this.asistenciaRepository.createQueryBuilder('asistencia')
      .where('asistencia.matricula_alumno = :matricula', { matricula })
      .andWhere('asistencia.nrc_materia = :nrc', { nrc: nrc_materia })
      .andWhere('asistencia.fecha_registro >= :hoy', { hoy })
      .getOne();

    if (yaRegistrado) {
      throw new BadRequestException('Ya tienes tu asistencia registrada para el día de hoy en esta materia.');
    }

    // Generamos un sufijo aleatorio de 8 caracteres
    const sufijoAleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Creamos la nueva asistencia con el prefijo ASIS-
    const nuevaAsistencia = this.asistenciaRepository.create({
      id: `ASIS-${sufijoAleatorio}`,
      matricula_alumno: matricula,
      nrc_materia: nrc_materia,
      estado: 'presente',
    });

    await this.asistenciaRepository.save(nuevaAsistencia);

    // 📤 Publicar evento asistencia.registrada
    if (rabbitmqService) {
      const evento: AsistenciaRegistradaEvent = {
        alumno_id: matricula,
        matricula: matricula,
        nrc_materia: nrc_materia,
        estado: 'presente',
        timestamp: new Date(),
        qr_token: token_qr,
      };

      await rabbitmqService.publishEvent(
        RABBITMQ_ROUTING_KEYS.ASISTENCIA_REGISTRADA,
        evento,
      );

      this.logger.log(
        `📤 Evento asistencia.registrada publicado para ${matricula}`
      );
    }

    return {
      mensaje: '¡Asistencia registrada con éxito!',
      id_registro: nuevaAsistencia.id,
      matricula: matricula,
      materia: nrc_materia,
      estado: 'presente',
    };
  }

  // ... (Tus métodos onAlumnoInscrito y calcularResumenAsistencia se quedan exactamente igual)
  async onAlumnoInscrito(event: AlumnoInscritoEvent) {
    try {
      this.logger.log(`📨 Evento recibido: Alumno ${event.matricula} inscrito a ${event.nrc_materia}`);
      this.logger.log(`✅ Alumno ${event.matricula} preparado para asistencias en NRC ${event.nrc_materia}`);
    } catch (error) {
      this.logger.error('❌ Error procesando evento alumno.inscrito:', error);
    }
  }

  async calcularResumenAsistencia(nrc_materia: string, rabbitmqService: RabbitMQService) {
    // Pegar aquí exactamente el código que ya tenías en este método, está perfecto.
    try {
      this.logger.log(`📊 Calculando resumen de asistencia para NRC ${nrc_materia}`);
      const asistencias = await this.asistenciaRepository.find({ where: { nrc_materia } });

      if (asistencias.length === 0) {
        this.logger.warn(`⚠️ No hay asistencias registradas para ${nrc_materia}`);
        return { mensaje: 'No hay asistencias registradas', nrc_materia, estudiantes_procesados: 0 };
      }

      const alumnosPorMatricula: { [key: string]: Asistencia[] } = {};
      for (const asistencia of asistencias) {
        if (!alumnosPorMatricula[asistencia.matricula_alumno]) {
          alumnosPorMatricula[asistencia.matricula_alumno] = [];
        }
        alumnosPorMatricula[asistencia.matricula_alumno].push(asistencia);
      }

      const resultados: any[] = [];
      const totalClases = Object.values(alumnosPorMatricula).length > 0
        ? Math.max(...Object.values(alumnosPorMatricula).map(a => a.length)) : 1;

      for (const [matricula, asistenciasAlumno] of Object.entries(alumnosPorMatricula)) {
        const asistencias_count = asistenciasAlumno.filter((a) => a.estado === 'presente').length;
        const faltas = asistenciasAlumno.length - asistencias_count;
        const porcentaje_asistencia = Math.round((asistencias_count / totalClases) * 100);

        const evento: AsistenciaResumenCalculadoEvent = {
          alumno_id: matricula, matricula, nrc_materia, total_clases: totalClases,
          asistencias: asistencias_count, faltas, porcentaje_asistencia,
          derecho_proyecto: porcentaje_asistencia >= 80, fecha_calculo: new Date(),
        };

        await rabbitmqService.publishEvent(RABBITMQ_ROUTING_KEYS.ASISTENCIA_RESUMEN_CALCULADO, evento);

        if (porcentaje_asistencia < 80) {
          const eventoSinDerecho: AlumnoSinDerechoProyectoEvent = {
            alumno_id: matricula, matricula, nrc_materia, motivo: 'asistencia_baja',
            porcentaje_asistencia, fecha_evento: new Date(),
          };
          await rabbitmqService.publishEvent(RABBITMQ_ROUTING_KEYS.ALUMNO_SIN_DERECHO_PROYECTO, eventoSinDerecho);
          this.logger.warn(`⚠️ ${matricula} sin derecho a proyecto en ${nrc_materia} (${porcentaje_asistencia}%)`);
        }

        resultados.push({
          matricula, total_clases: totalClases, asistencias: asistencias_count,
          faltas, porcentaje_asistencia, derecho_proyecto: porcentaje_asistencia >= 80,
        });
      }

      this.logger.log(`✅ Resumen calculado para ${resultados.length} estudiantes en ${nrc_materia}`);
      return { mensaje: 'Resumen de asistencia calculado', nrc_materia, estudiantes_procesados: resultados.length, resumen: resultados };
    } catch (error) {
      this.logger.error('❌ Error calculando resumen:', error);
      throw error;
    }
  }
}