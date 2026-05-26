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
        qr_token: token_qr, // <-- CORRECCIÓN: Faltaba enviar el token
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

  /**
   * 📊 Calcular resumen de asistencia para una materia
   * Endpoint: GET /asistencias/calcular-resumen/:nrc_materia
   */
  async calcularResumenAsistencia(nrc_materia: string, rabbitmqService: RabbitMQService) {
    try {
      this.logger.log(`📊 Calculando resumen de asistencia para NRC ${nrc_materia}`);

      // Obtener todas las asistencias de esta materia
      const asistencias = await this.asistenciaRepository.find({
        where: { nrc_materia },
      });

      if (asistencias.length === 0) {
        this.logger.warn(`⚠️ No hay asistencias registradas para ${nrc_materia}`);
        return {
          mensaje: 'No hay asistencias registradas',
          nrc_materia,
          estudiantes_procesados: 0,
        };
      }

      // Agrupar por alumno
      const alumnosPorMatricula: { [key: string]: Asistencia[] } = {};
      for (const asistencia of asistencias) {
        if (!alumnosPorMatricula[asistencia.matricula_alumno]) {
          alumnosPorMatricula[asistencia.matricula_alumno] = [];
        }
        alumnosPorMatricula[asistencia.matricula_alumno].push(asistencia);
      }

      // Procesar cada alumno
      const resultados: any[] = []; // <-- CORRECCIÓN: Tipado explícito para evitar error "never[]"
      const totalClases = Object.values(alumnosPorMatricula).length > 0
        ? Math.max(...Object.values(alumnosPorMatricula).map(a => a.length))
        : 1;

      for (const [matricula, asistenciasAlumno] of Object.entries(
        alumnosPorMatricula,
      )) {
        const asistencias_count = asistenciasAlumno.filter(
          (a) => a.estado === 'presente',
        ).length;
        const faltas = asistenciasAlumno.length - asistencias_count;
        const porcentaje_asistencia = Math.round(
          (asistencias_count / totalClases) * 100,
        );

        const evento: AsistenciaResumenCalculadoEvent = {
          alumno_id: matricula,
          matricula,
          nrc_materia,
          total_clases: totalClases,
          asistencias: asistencias_count,
          faltas,
          porcentaje_asistencia,
          derecho_proyecto: porcentaje_asistencia >= 80,
          fecha_calculo: new Date(),
        };

        // Publicar evento de resumen
        await rabbitmqService.publishEvent(
          RABBITMQ_ROUTING_KEYS.ASISTENCIA_RESUMEN_CALCULADO,
          evento,
        );

        // Si está bajo 80%, publicar evento de sin derecho
        if (porcentaje_asistencia < 80) {
          const eventoSinDerecho: AlumnoSinDerechoProyectoEvent = {
            alumno_id: matricula,
            matricula,
            nrc_materia,
            motivo: 'asistencia_baja',
            porcentaje_asistencia,
            fecha_evento: new Date(), // <-- CORRECCIÓN: Faltaba la fecha
          };

          await rabbitmqService.publishEvent(
            RABBITMQ_ROUTING_KEYS.ALUMNO_SIN_DERECHO_PROYECTO,
            eventoSinDerecho,
          );

          this.logger.warn(
            `⚠️ ${matricula} sin derecho a proyecto en ${nrc_materia} (${porcentaje_asistencia}%)`
          );
        }

        resultados.push({
          matricula,
          total_clases: totalClases,
          asistencias: asistencias_count,
          faltas,
          porcentaje_asistencia, // <-- CORRECCIÓN: Enviarlo como número en vez de string
          derecho_proyecto: porcentaje_asistencia >= 80,
        });
      }

      this.logger.log(
        `✅ Resumen calculado para ${resultados.length} estudiantes en ${nrc_materia}`
      );

      return {
        mensaje: 'Resumen de asistencia calculado',
        nrc_materia,
        estudiantes_procesados: resultados.length,
        resumen: resultados,
      };
    } catch (error) {
      this.logger.error('❌ Error calculando resumen:', error);
      throw error;
    }
  }
}