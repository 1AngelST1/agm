/**
 * 📨 Módulo RabbitMQ - Para usar en cualquier microservicio
 */

import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService], // Exportar para que otros módulos lo usen
})
export class RabbitMQModule {}
