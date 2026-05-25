import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as path from 'path';

// Función para obtener la ruta de los .proto
const getProtoPath = (protoFile: string) => {
  if (process.env.NODE_ENV === 'production') {
    return `/app/proto/${protoFile}`;
  }
  const proto = path.join(__dirname, `../../proto/${protoFile}`);
  console.log(`🔧 [ms-reportes] Cargando proto: ${proto}`);
  return proto;
};

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CALIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'calificaciones',
          protoPath: getProtoPath('calificaciones.proto'),
          url: `${process.env.CALIFICACIONES_GRPC_HOST || 'localhost'}:${process.env.CALIFICACIONES_GRPC_PORT || 5003}`,
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: getProtoPath('alumnos.proto'),
          url: `${process.env.ALUMNOS_GRPC_HOST || 'localhost'}:${process.env.ALUMNOS_GRPC_PORT || 5002}`,
        },
      },
      {
        name: 'ASISTENCIAS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'asistencias',
          protoPath: getProtoPath('asistencias.proto'),
          url: `${process.env.ASISTENCIAS_GRPC_HOST || 'localhost'}:${process.env.ASISTENCIAS_GRPC_PORT || 5004}`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
