/**
 * 📨 RabbitMQ Listener - Consumidor de eventos para ms-calificaciones
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RABBITMQ_CONFIG, RABBITMQ_EXCHANGE, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
import { AlumnoInscritoEvent, AsistenciaResumenCalculadoEvent, PeriodoIniciado, PeriodoCerradoEvent } from '@shared/events.types';
import { AppController } from './app.controller';

@Injectable()
export class RabbitMQListener implements OnModuleInit {
  private logger = new Logger('RabbitMQListener');
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private appController: AppController) {}

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
      // Crear queue para calificaciones
      await this.channel!.assertQueue(RABBITMQ_QUEUES.CALIFICACIONES, {
        durable: true,
      });

      // Vincular eventos que quiero escuchar
      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.CALIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO
      );

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.CALIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.ASISTENCIA_RESUMEN_CALCULADO
      );

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.CALIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.PERIODO_INICIADO
      );

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.CALIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.PERIODO_CERRADO
      );

      // Consumir mensajes
      await this.channel!.consume(RABBITMQ_QUEUES.CALIFICACIONES, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            const routingKey = msg.fields.routingKey;

            this.logger.log(`📨 Mensaje recibido: ${routingKey}`);

            if (routingKey === RABBITMQ_ROUTING_KEYS.ALUMNO_INSCRITO) {
              await this.appController.onAlumnoInscrito(content as AlumnoInscritoEvent);
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.ASISTENCIA_RESUMEN_CALCULADO) {
              await this.appController.onAsistenciaResumenCalculado(content as AsistenciaResumenCalculadoEvent);
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.PERIODO_INICIADO) {
              this.logger.log(`📅 Período iniciado: ${content.numero_periodo}`);
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.PERIODO_CERRADO) {
              this.logger.log(`📅 Período cerrado: ${content.numero_periodo}`);
            }

            this.channel!.ack(msg);
          } catch (error) {
            this.logger.error('❌ Error procesando mensaje:', error);
            this.channel!.nack(msg, false, true);
          }
        }
      });

      this.logger.log(`✅ Escuchando en queue: ${RABBITMQ_QUEUES.CALIFICACIONES}`);
    } catch (error) {
      this.logger.error('❌ Error configurando listeners:', error);
      throw error;
    }
  }
}
