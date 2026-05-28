import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitMQModule } from './rabbitmq.module';
import { RabbitMQListener } from './rabbitmq.listener';

@Module({
  imports: [
    RabbitMQModule,
    // 🔐 Cliente gRPC para conectar a MS-Auth
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, '../../proto/auth.proto'),
          url: `ms-auth:5000`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, RabbitMQListener],
})
export class AppModule {}
