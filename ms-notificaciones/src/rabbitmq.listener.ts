/**
 * 📨 RabbitMQ Listener - Consumidor de eventos para ms-notificaciones
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RABBITMQ_CONFIG, RABBITMQ_EXCHANGE, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
import { AlumnoInscritoEvent, CalificacionFinalAsignadaEvent, AsistenciaResumenCalculadoEvent } from '@shared/events.types';

@Injectable()
export class RabbitMQListener implements OnModuleInit {
  private logger = new Logger('RabbitMQListener');
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async onModuleInit() {
    try {
      await this.connect();
      await this.setupListeners();
    } catch (error) {
      this.logger.error('❌ Error en RabbitMQ Listener:', error);
      setTimeout(() => this.onModuleInit(), 5000);
    }
  }

  private async connect() {
    try {
      this.connection = await amqp.connect(RABBITMQ_CONFIG.url);
      this.channel = await this.connection!.createChannel();

      await this.channel!.assertExchange(
        RABBITMQ_EXCHANGE,
        RABBITMQ_CONFIG.exchange.type,
        { durable: RABBITMQ_CONFIG.exchange.durable }
      );

      this.logger.log('✅ Conectado a RabbitMQ (Listener)');
    } catch (error) {
      this.logger.error('❌ Error conectando:', error);
      throw error;
    }
  }

  private async setupListeners() {
    if (!this.channel) return;

    try {
      // Crear queue para notificaciones
      await this.channel!.assertQueue(RABBITMQ_QUEUES.NOTIFICACIONES, {
        durable: true,
      });

      // Vincular eventos que quiero escuchar
      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.NOTIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO
      );

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.NOTIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.CALIFICACION_FINAL_ASIGNADA
      );

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.NOTIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.ASISTENCIA_RESUMEN_CALCULADO
      );

      // Consumir mensajes
      await this.channel!.consume(RABBITMQ_QUEUES.NOTIFICACIONES, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            const routingKey = msg.fields.routingKey;

            this.logger.log(`📨 Mensaje recibido: ${routingKey}`);

            if (routingKey === RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO) {
              await this.onAlumnoInscrito(content as AlumnoInscritoEvent);
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.CALIFICACION_FINAL_ASIGNADA) {
              await this.onCalificacionFinalAsignada(content as CalificacionFinalAsignadaEvent);
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.ASISTENCIA_RESUMEN_CALCULADO) {
              await this.onAsistenciaResumenCalculado(content as AsistenciaResumenCalculadoEvent);
            }

            this.channel!.ack(msg);
          } catch (error) {
            this.logger.error('❌ Error procesando mensaje:', error);
            this.channel!.nack(msg, false, true);
          }
        }
      });

      this.logger.log(`✅ Escuchando en queue: ${RABBITMQ_QUEUES.NOTIFICACIONES}`);
    } catch (error) {
      this.logger.error('❌ Error configurando listeners:', error);
      throw error;
    }
  }

  /**
   * 📨 Consumidor: Alumno se inscribió a una materia
   */
  private async onAlumnoInscrito(event: AlumnoInscritoEvent) {
    try {
      this.logger.log(
        `📧 Notificación: Alumno ${event.matricula} se inscribió a ${event.nrc_materia}`
      );

      // Aquí se puede:
      // 1. Enviar email de bienvenida al alumno
      // 2. Notificar al docente de nuevo alumno inscrito
      // 3. Generar recordatorio de inicio de clases

      this.logger.log(`✅ Notificación de inscripción enviada para ${event.matricula}`);
    } catch (error) {
      this.logger.error('❌ Error procesando alumno.inscrito:', error);
    }
  }

  /**
   * 📨 Consumidor: Se asignó calificación final
   */
  private async onCalificacionFinalAsignada(event: CalificacionFinalAsignadaEvent) {
    try {
      this.logger.log(
        `📧 Notificación: Calificación final asignada a ${event.matricula}`
      );

      // Aquí se puede:
      // 1. Enviar email al alumno con su calificación final
      // 2. Notificar sobre estado de aprobación/reprobación
      // 3. Si fue rechazado, informar sobre derechos de reposición

      const estado = event.estatus === 'Aprobado' ? '✅ Aprobado' : '❌ Reprobado';
      this.logger.log(
        `📧 Calificación ${event.calificacion_final} - ${estado} enviada a ${event.matricula}`
      );
    } catch (error) {
      this.logger.error('❌ Error procesando calificacion.final.asignada:', error);
    }
  }

  /**
   * 📨 Consumidor: Se calculó resumen de asistencia
   */
  private async onAsistenciaResumenCalculado(event: AsistenciaResumenCalculadoEvent) {
    try {
      this.logger.log(
        `📧 Notificación: Resumen asistencia para ${event.matricula}`
      );

      // Aquí se puede:
      // 1. Notificar al alumno sobre su porcentaje de asistencia
      // 2. Si falta derecho a proyecto, informar al docente
      // 3. Enviar recordatorio si está próximo a perder derecho

      if (event.derecho_proyecto) {
        this.logger.log(
          `✅ ${event.matricula} tiene derecho a proyecto (${event.porcentaje_asistencia}%)`
        );
      } else {
        this.logger.warn(
          `⚠️ ${event.matricula} SIN derecho a proyecto (${event.porcentaje_asistencia}%)`
        );
      }
    } catch (error) {
      this.logger.error('❌ Error procesando asistencia.resumen.calculado:', error);
    }
  }
}
