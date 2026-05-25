/**
 * 📨 Módulo RabbitMQ - Servicio para publicar eventos
 * Se usa en todos los microservicios que necesitan publicar eventos
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RABBITMQ_EXCHANGE, RABBITMQ_CONFIG } from '@shared/rabbitmq.constants';

export interface RabbitMQEventPayload {
  [key: string]: any;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('RabbitMQService');
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async onModuleInit() {
    try {
      await this.connect();
    } catch (error) {
      this.logger.error('❌ Error conectando a RabbitMQ:', error);
      // Reintentar conexión después de 5 segundos
      setTimeout(() => this.onModuleInit(), 5000);
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * 🔌 Conectar a RabbitMQ
   */
  private async connect() {
    try {
      this.connection = await amqp.connect(RABBITMQ_CONFIG.url);
      this.channel = await this.connection!.createChannel();

      // Crear exchange si no existe
      await this.channel!.assertExchange(
        RABBITMQ_EXCHANGE,
        RABBITMQ_CONFIG.exchange.type,
        { durable: RABBITMQ_CONFIG.exchange.durable }
      );

      this.logger.log(
        `✅ Conectado a RabbitMQ en ${RABBITMQ_CONFIG.url}`
      );
    } catch (error) {
      this.logger.error('❌ No se pudo conectar a RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * 📤 Publicar un evento
   * @param routingKey - La clave de enrutamiento (ej: "alumno.inscrito")
   * @param payload - Los datos del evento
   */
  async publishEvent(routingKey: string, payload: RabbitMQEventPayload): Promise<void> {
    if (!this.channel) {
      this.logger.warn('⚠️ Canal no disponible, intentando reconectar...');
      await this.connect();
    }

    try {
      const message = Buffer.from(JSON.stringify(payload));
      this.channel!.publish(
        RABBITMQ_EXCHANGE,
        routingKey,
        message,
        { persistent: true } // Asegurar que el mensaje persiste
      );

      this.logger.log(`📤 Evento publicado: ${routingKey}`);
      return;
    } catch (error) {
      this.logger.error(
        `❌ Error publicando evento ${routingKey}:`,
        error
      );
      throw error;
    }
  }

  /**
   * 🔌 Desconectar de RabbitMQ
   */
  private async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('✅ Desconectado de RabbitMQ');
    } catch (error) {
      this.logger.error('❌ Error desconectando de RabbitMQ:', error);
    }
  }

  /**
   * 🏥 Verificar si está conectado
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }
}
