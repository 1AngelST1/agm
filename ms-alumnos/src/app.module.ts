/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Alumno } from './alumno.entity';
import { Inscripcion } from './inscripcion.entity';
import { RabbitMQModule } from './rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_alumnos_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Alumno, Inscripcion]),
    RabbitMQModule,
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
      {
        name: 'NOTIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'notificaciones',
          protoPath: '/app/proto/notificaciones.proto',
          url: 'ms-notificaciones:5014',
        },
      },
      {
        name: 'PERIODOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'periodos',
          protoPath: '/app/proto/periodos.proto',
          url: 'ms-periodos:5001',
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
