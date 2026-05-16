import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asistencia } from './asistencia.entity';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Asistencia)
    private asistenciaRepository: Repository<Asistencia>,
    @Inject('REDIS_CLIENT')
    private redisClient: Redis,
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
}
