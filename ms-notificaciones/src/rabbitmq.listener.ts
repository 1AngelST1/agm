/**
 * 📨 RabbitMQ Listener - Consumidor de eventos para ms-notificaciones
 * Part 9: Incluye Dead Letter Queue (DLQ) listener para manejo de errores
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { RABBITMQ_CONFIG, RABBITMQ_EXCHANGE, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';
import { AlumnoInscritoEvent, CalificacionFinalAsignadaEvent, AsistenciaResumenCalculadoEvent, InscripcionRechazadaEvent, MateriaCargaLlenaEvent } from '@shared/events.types';

interface DLQMessage {
  originalRoutingKey: string;
  payload: any;
  failureReason: string;
  failedAt: string;
  retriesExhausted: boolean;
}

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

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.NOTIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.INSCRIPCION_RECHAZADA
      );

      await this.channel!.bindQueue(
        RABBITMQ_QUEUES.NOTIFICACIONES,
        RABBITMQ_EXCHANGE,
        RABBITMQ_ROUTING_KEYS.MATERIA_CARGA_LLENA
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
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.INSCRIPCION_RECHAZADA) {
              await this.onInscripcionRechazada(content as InscripcionRechazadaEvent);
            } else if (routingKey === RABBITMQ_ROUTING_KEYS.MATERIA_CARGA_LLENA) {
              await this.onMateriaCargaLlena(content as MateriaCargaLlenaEvent);
            }

            this.channel!.ack(msg);
          } catch (error) {
            this.logger.error('❌ Error procesando mensaje:', error);
            this.channel!.nack(msg, false, true);
          }
        }
      });

      this.logger.log(`✅ Escuchando en queue: ${RABBITMQ_QUEUES.NOTIFICACIONES}`);

      // Part 9: Configurar Dead Letter Queue listener
      await this.setupDLQListener();
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

  /**
   * 📨 Consumidor: Se rechazó inscripción de alumno
   */
  private async onInscripcionRechazada(event: InscripcionRechazadaEvent) {
    try {
      this.logger.warn(
        `📧 Notificación: Inscripción rechazada para ${event.matricula} - Motivo: ${event.motivo}`
      );

      // Aquí se puede:
      // 1. Enviar email al alumno explicando razón del rechazo
      // 2. Incluir acciones correctivas (revisar créditos, validar duplicados)
      // 3. Notificar al coordinador académico

      if (event.motivo === 'ya_inscrito') {
        this.logger.log(
          `ℹ️ ${event.matricula} ya estaba inscrito en ${event.nrc_materia}`
        );
      } else if (event.motivo === 'carga_excedida') {
        this.logger.warn(
          `⚠️ ${event.matricula} superó carga máxima: ${event.detalle}`
        );
      }
    } catch (error) {
      this.logger.error('❌ Error procesando inscripcion.rechazada:', error);
    }
  }

  /**
   * 📨 Consumidor: Materia llegó a capacidad máxima
   */
  private async onMateriaCargaLlena(event: MateriaCargaLlenaEvent) {
    try {
      this.logger.warn(
        `📧 Notificación: Materia ${event.nrc_materia} alcanzó capacidad máxima`
      );

      // Aquí se puede:
      // 1. Notificar a docente que grupo está lleno
      // 2. Alertar a coordinador para crear grupo adicional
      // 3. Notificar a estudiantes en cola de espera

      this.logger.log(
        `📊 Materia ${event.nrc_materia}: ${event.inscritos_actuales}/${event.capacidad_maxima} inscritos`
      );
    } catch (error) {
      this.logger.error('❌ Error procesando materia.carga.llena:', error);
    }
  }

  /**
   * 💀 Part 9: Configurar Dead Letter Queue listener
   * Escucha mensajes que fallaron después de reintentos
   */
  private async setupDLQListener() {
    if (!this.channel) return;

    try {
      // Crear DLQ si no existe
      await this.channel!.assertQueue(RABBITMQ_QUEUES.DEAD_LETTER, {
        durable: true,
      });

      // Consumir mensajes del DLQ
      await this.channel!.consume(RABBITMQ_QUEUES.DEAD_LETTER, async (msg) => {
        if (msg) {
          try {
            const content: DLQMessage = JSON.parse(msg.content.toString());
            await this.onDeadLetterReceived(content);
            this.channel!.ack(msg);
          } catch (error) {
            this.logger.error('❌ Error procesando DLQ:', error);
            this.channel!.nack(msg, false, true);
          }
        }
      });

      this.logger.log(`✅ DLQ listener configurado: ${RABBITMQ_QUEUES.DEAD_LETTER}`);
    } catch (error) {
      this.logger.error('❌ Error configurando DLQ listener:', error);
    }
  }

  /**
   * 💀 Part 9: Consumidor: Mensaje llegó a Dead Letter Queue
   * Estos son mensajes que fallaron tras múltiples reintentos
   */
  private async onDeadLetterReceived(dlqMessage: DLQMessage) {
    try {
      this.logger.error(
        `💀 DEAD LETTER RECIBIDO: ${dlqMessage.originalRoutingKey}`,
        {
          failureReason: dlqMessage.failureReason,
          failedAt: dlqMessage.failedAt,
          retriesExhausted: dlqMessage.retriesExhausted,
        }
      );

      // Part 9: Opciones de recuperación:
      // 1. Registrar en base de datos para auditoría
      // 2. Alertar a administrador
      // 3. Intentar procesar con lógica alternativa
      // 4. Guardar para reprocessing manual

      // Aquí se podría:
      // - Enviar alert email a administrador
      // - Guardar en tabla de errores para análisis
      // - Llamar a servicio de recuperación
      // - Intentar procesar con fallback

      this.logger.warn(
        `⚠️ Evento enviado a DLQ para recuperación manual. ` +
        `Routing Key: ${dlqMessage.originalRoutingKey}`
      );

      // Ejemplo: Log detallado del payload para debugging
      this.logger.debug(
        `📋 DLQ Payload: ${JSON.stringify(dlqMessage.payload, null, 2)}`
      );
    } catch (error) {
      this.logger.error('❌ Error manejando Dead Letter:', error);
    }
  }
}
