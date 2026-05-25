import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asistencia } from './asistencia.entity';
import { RabbitMQService } from './rabbitmq.service';
import { AlumnoInscritoEvent } from '@shared/events.types';
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
  async registrarAsistenciaAlumno(matricula: string, token_qr: string) {
    const nrc_materia = await this.redisClient.get(`qr_asistencia:${token_qr}`);

    if (!nrc_materia) {
      throw new BadRequestException(
        '¡Ups! Este código QR es inválido o ya expiró.',
      );
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

    return {
      mensaje: '¡Asistencia registrada con éxito!',
      id_registro: nuevaAsistencia.id,
      matricula: matricula,
      materia: nrc_materia,
      estado: 'presente',
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

      // Aquí se puede:
      // 1. Crear una estructura de grupo para asistencias
      // 2. Inicializar contadores de asistencia
      // 3. Preparar datos para el QR

      this.logger.log(
        `✅ Alumno ${event.matricula} preparado para asistencias en NRC ${event.nrc_materia}`
      );
    } catch (error) {
      this.logger.error('❌ Error procesando evento alumno.inscrito:', error);
    }
  }
}
