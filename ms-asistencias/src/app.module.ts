/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import Redis from 'ioredis';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Asistencia } from './asistencia.entity';
import { SesionAsistencia } from './sesion-asistencia.entity';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisConfigModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_asistencias_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Asistencia, SesionAsistencia]),
    RedisConfigModule,
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, '../../proto/auth.proto'),
          url: process.env.AUTH_GRPC_HOST
            ? `${process.env.AUTH_GRPC_HOST}:${process.env.AUTH_GRPC_PORT || 5000}`
            : 'localhost:5000',
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: join(__dirname, '../../proto/alumnos.proto'),
          url: process.env.ALUMNOS_GRPC_HOST
            ? `${process.env.ALUMNOS_GRPC_HOST}:${process.env.ALUMNOS_GRPC_PORT || 5002}`
            : 'localhost:5002',
        },
      },
      {
        name: 'PERIODOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'periodos',
          protoPath: join(__dirname, '../../proto/periodos.proto'),
          url: process.env.PERIODOS_GRPC_HOST
            ? `${process.env.PERIODOS_GRPC_HOST}:${process.env.PERIODOS_GRPC_PORT || 5001}`
            : 'localhost:5001',
        },
      },
      {
        name: 'NOTIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'notificaciones',
          protoPath: join(__dirname, '../../proto/notificaciones.proto'),
          url: process.env.NOTIFICACIONES_GRPC_HOST
            ? `${process.env.NOTIFICACIONES_GRPC_HOST}:${process.env.NOTIFICACIONES_GRPC_PORT || 5005}`
            : 'localhost:5005',
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
