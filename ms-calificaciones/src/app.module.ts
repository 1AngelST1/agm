import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Materia } from './materia.entity';
import { Grupo } from './grupo.entity';
import { Calificacion } from './calificacion.entity';
import { CalificacionFinal } from './calificacion-final.entity';
import { Ponderacion } from './ponderacion.entity';
import { Actividad } from './actividad.entity';
import { JwtStrategy } from './guards/jwt.strategy';
import { RabbitMQModule } from './rabbitmq.module';
import { RabbitMQListener } from './rabbitmq.listener';
import { join } from 'path';

// Función para obtener la ruta de los .proto
const getProtoPath = (protoFile: string) => {
  if (process.env.NODE_ENV === 'production') {
    return `/app/proto/${protoFile}`;
  }
  return path.join(__dirname, `../../proto/${protoFile}`);
};

@Module({
  imports: [
    PassportModule,
    RabbitMQModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_calificaciones_db',
      entities: [Materia, Grupo, Calificacion, CalificacionFinal, Ponderacion, Actividad],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Materia, Grupo, Calificacion, CalificacionFinal, Ponderacion, Actividad]),

    // 📞 REGISTRO DE TODOS LOS CLIENTES gRPC
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: getProtoPath('auth.proto'),
          url: 'ms-auth:5000',
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: getProtoPath('alumnos.proto'),
          url: 'ms-alumnos:5002',
        },
      },
      // 🚀 CONEXIÓN HACIA NOTIFICACIONES
      {
        name: 'NOTIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'notificaciones',
          protoPath: join(__dirname, '../../proto/notificaciones.proto'),
          url: 'ms-notificaciones:5014',
        },
      },
      // 🚀 CONEXIÓN HACIA PERIODOS
      {
        name: 'PERIODOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'periodos',
          protoPath: getProtoPath('periodos.proto'),
          url: `ms-periodos:5003`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy, RabbitMQListener],
})
export class AppModule {}