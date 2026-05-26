/**
 * 📨 Módulo RabbitMQ - Servicio para publicar eventos con retry logic
 * Part 9: Error Handling mejorado con exponential backoff y DLQ
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { 
  RABBITMQ_CONFIG, 
  RABBITMQ_EXCHANGE, 
  RABBITMQ_QUEUES, 
  RABBITMQ_RETRY_CONFIG,
  RABBITMQ_ROUTING_KEYS 
} from '@shared/rabbitmq.constants';

export interface RabbitMQEventPayload {
  [key: string]: any;
  // Part 9: Metadata para rastrear reintentos
  _retryCount?: number;
  _firstAttempt?: string;
}

interface PublishOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  exponentialBackoff?: boolean;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('RabbitMQService');
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private dlxChannel: amqp.Channel | null = null;

  async onModuleInit() {
    try {
      await this.connect();
      await this.setupDeadLetterExchange();
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
      this.connection = (await amqp.connect(RABBITMQ_CONFIG.url)) as any;
      this.channel = await (this.connection as any).createChannel();

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
   * 💀 Configurar Dead Letter Exchange (DLX)
   * Part 9: Dead Letter Queue para mensajes fallidos
   */
  private async setupDeadLetterExchange() {
    if (!this.channel) return;

    try {
      // Crear DLX (Dead Letter Exchange)
      await this.channel!.assertExchange(
        RABBITMQ_CONFIG.deadLetterExchange,
        'topic',
        { durable: true }
      );

      // Crear DLQ (Dead Letter Queue)
      await this.channel!.assertQueue(RABBITMQ_QUEUES.DEAD_LETTER, {
        durable: true,
        arguments: {
          'x-message-ttl': RABBITMQ_RETRY_CONFIG.DLQ_MESSAGE_TTL_MS,
        },
      });

      // Vincular DLQ al DLX
      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.DEAD_LETTER,
        RABBITMQ_CONFIG.deadLetterExchange,
        '#' // Recibe todos los eventos del DLX
      );

      this.logger.log(
        `✅ Dead Letter Exchange configurado: ${RABBITMQ_CONFIG.deadLetterExchange}`
      );
    } catch (error) {
      this.logger.error('❌ Error configurando DLX:', error);
    }
  }

  /**
   * 📤 Publicar un evento (sin reintentos - para compatibilidad)
   * @param routingKey - La clave de enrutamiento (ej: "alumno.inscrito")
   * @param payload - Los datos del evento
   */
  async publishEvent(routingKey: string, payload: RabbitMQEventPayload): Promise<void> {
    // Usar publishEventWithRetry con opciones por defecto
    await this.publishEventWithRetry(routingKey, payload);
  }

  /**
   * 📤 Publicar un evento CON reintentos y exponential backoff
   * Part 9: Retry logic con manejo automático de DLQ
   * @param routingKey - La clave de enrutamiento
   * @param payload - Los datos del evento
   * @param options - Configuración de reintentos
   */
  async publishEventWithRetry(
    routingKey: string,
    payload: RabbitMQEventPayload,
    options: PublishOptions = {}
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? RABBITMQ_RETRY_CONFIG.MAX_RETRIES;
    const initialDelay = options.retryDelayMs ?? RABBITMQ_RETRY_CONFIG.RETRY_DELAY_MS;
    const useExponentialBackoff = options.exponentialBackoff ?? true;

    // Inicializar metadata si no existe
    if (!payload._firstAttempt) {
      payload._firstAttempt = new Date().toISOString();
      payload._retryCount = 0;
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        if (!this.channel) {
          this.logger.warn('⚠️ Canal no disponible, intentando reconectar...');
          await this.connect();
        }

        const message = Buffer.from(JSON.stringify(payload));
        
        // Configurar opciones de mensajes con Dead Letter Exchange
        const publishOptions: amqp.Options.Publish = {
          persistent: true,
          headers: {
            'x-retry-count': attempt,
            'x-first-attempt': payload._firstAttempt,
          },
          // Si el mensaje es rechazado, enviar al DLX
          ...(attempt >= maxRetries && {
            'x-dead-letter-exchange': RABBITMQ_CONFIG.deadLetterExchange,
          }),
        };

        this.channel!.publish(
          RABBITMQ_EXCHANGE,
          routingKey,
          message,
          publishOptions
        );

        this.logger.log(
          `📤 Evento publicado: ${routingKey} ${attempt > 0 ? `(Reintento ${attempt}/${maxRetries})` : ''}`
        );
        return; // ✅ Éxito
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt <= maxRetries) {
          // Calcular delay con exponential backoff
          const delay = useExponentialBackoff
            ? initialDelay * Math.pow(2, attempt - 1)
            : initialDelay;

          this.logger.warn(
            `⚠️ Error publicando ${routingKey} (intento ${attempt}/${maxRetries}). ` +
            `Reintentando en ${delay}ms...`
          );

          // Esperar antes de reintentar
          await this.sleep(delay);
        }
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    this.logger.error(
      `❌ Falló publicar evento ${routingKey} después de ${maxRetries} reintentos. ` +
      `Enviando a Dead Letter Queue...`,
      lastError
    );

    // Enviar manualmente a DLQ como último recurso
    await this.sendToDeadLetterQueue(routingKey, payload, lastError);

    throw new Error(
      `Failed to publish event ${routingKey} after ${maxRetries} retries. ` +
      `Message sent to DLQ for manual review.`
    );
  }

  /**
   * 💀 Enviar mensaje a Dead Letter Queue manualmente
   * Part 9: Almacenar mensajes fallidos para análisis posterior
   */
  private async sendToDeadLetterQueue(
    routingKey: string,
    payload: RabbitMQEventPayload,
    error: Error | null
  ): Promise<void> {
    try {
      if (!this.channel) return;

      const dlqMessage = {
        originalRoutingKey: routingKey,
        payload,
        failureReason: error?.message || 'Unknown error',
        failedAt: new Date().toISOString(),
        retriesExhausted: true,
      };

      const message = Buffer.from(JSON.stringify(dlqMessage));

      // Asegurar que la queue existe
      await this.channel!.assertQueue(RABBITMQ_QUEUES.DEAD_LETTER, {
        durable: true,
      });

      // Enviar directamente a la DLQ
      this.channel!.sendToQueue(
        RABBITMQ_QUEUES.DEAD_LETTER,
        message,
        { persistent: true }
      );

      this.logger.log(
        `💀 Mensaje enviado a DLQ: ${RABBITMQ_QUEUES.DEAD_LETTER} ` +
        `(routingKey: ${routingKey})`
      );
    } catch (error) {
      this.logger.error('❌ Error enviando a DLQ:', error);
    }
  }

  /**
   * ⏸️ Utilidad: Sleep para reintentos
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        await (this.connection as any).close();
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
