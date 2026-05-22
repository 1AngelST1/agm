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

// Función para obtener la ruta de los .proto
const getProtoPath = (protoFile: string) => {
  if (process.env.NODE_ENV === 'production') {
    return `/app/proto/${protoFile}`;
  }
  const proto = path.join(__dirname, `../../proto/${protoFile}`);
  console.log(`🔧 [ms-calificaciones] Cargando proto: ${proto}`);
  return proto;
};

@Module({
  imports: [
    PassportModule,
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
          url: `${process.env.AUTH_GRPC_HOST || 'localhost'}:${process.env.AUTH_GRPC_PORT || '5000'}`,
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: getProtoPath('alumnos.proto'),
          url: `${process.env.ALUMNOS_GRPC_HOST || 'localhost'}:${process.env.ALUMNOS_GRPC_PORT || '5002'}`,
        },
      },
      // 🚀 CONEXIÓN HACIA NOTIFICACIONES
      {
        name: 'NOTIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'notificaciones',
          protoPath: getProtoPath('notificaciones.proto'),
          url: `${process.env.NOTIF_GRPC_HOST || 'localhost'}:${process.env.NOTIF_GRPC_PORT || '5014'}`,
        },
      },
      // 🚀 CONEXIÓN HACIA PERIODOS
      {
        name: 'PERIODOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'periodos',
          protoPath: getProtoPath('periodos.proto'),
          url: '0.0.0.0:5001',
          loader: { keepCase: true },
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}