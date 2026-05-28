import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Periodo } from './periodo.entity';
import { Materia } from './materia.entity';
import { RabbitMQModule } from './rabbitmq.module';
import { RabbitMQListener } from './rabbitmq.listener';

@Module({
  imports: [
    RabbitMQModule,
    // 🗄️ Base de datos
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_periodos_db',
      entities: [Periodo, Materia],
      synchronize: true,
      logging: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([Periodo, Materia]),

    // 🔐 Cliente gRPC para conectar a MS-Auth
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: '/app/proto/auth.proto',
          url: 'ms-auth:5000',
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, RabbitMQListener],
})
export class AppModule {}
