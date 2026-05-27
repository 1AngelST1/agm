/**
 * 📨 RabbitMQ Listener - Consumidor de eventos para ms-periodos
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RABBITMQ_CONFIG, RABBITMQ_EXCHANGE, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
import { CalificacionFinalAsignadaEvent } from '@shared/events.types';

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
      this.connection = (await amqp.connect(RABBITMQ_CONFIG.url)) as any;
      this.channel = await (this.connection as any).createChannel();

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
      // Crear queue para períodos
      await this.channel!.assertQueue(RABBITMQ_QUEUES.PERIODOS, {
        durable: true,
      });

      // Vincular eventos que quiero escuchar
      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.PERIODOS,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.CALIFICACION_FINAL_ASIGNADA
      );

      // Consumir mensajes
      await this.channel!.consume(RABBITMQ_QUEUES.PERIODOS, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            const routingKey = msg.fields.routingKey;

            this.logger.log(`📨 Mensaje recibido: ${routingKey}`);

            if (routingKey === RABBITMQ_ROUTING_KEYS.CALIFICACION_FINAL_ASIGNADA) {
              await this.onCalificacionFinalAsignada(content as CalificacionFinalAsignadaEvent);
            }

            this.channel!.ack(msg);
          } catch (error) {
            this.logger.error('❌ Error procesando mensaje:', error);
            this.channel!.nack(msg, false, true);
          }
        }
      });

      this.logger.log(`✅ Escuchando en queue: ${RABBITMQ_QUEUES.PERIODOS}`);
    } catch (error) {
      this.logger.error('❌ Error configurando listeners:', error);
      throw error;
    }
  }

  /**
   * 📨 Consumidor: Se asignó calificación final
   * Se ejecuta automáticamente cuando llega el evento desde RabbitMQ
   */
  private async onCalificacionFinalAsignada(event: CalificacionFinalAsignadaEvent) {
    try {
      this.logger.log(
        `📨 Evento recibido: Calificación final asignada para ${event.matricula} en ${event.nrc_materia}`
      );

      // Aquí se puede:
      // 1. Registrar que esta calificación fue asignada
      // 2. Verificar si se puede cerrar el período
      // 3. Generar reporte de período cerrado

      this.logger.log(
        `✅ Evento calificación final procesado para período ${event.nrc_materia}`
      );
    } catch (error) {
      this.logger.error('❌ Error procesando evento calificacion.final.asignada:', error);
    }
  }
}
