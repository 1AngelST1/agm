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
          url: 'localhost:5003',
          loader: { keepCase: true }, // 🔥 LÍNEA MÁGICA RECEPTORA
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: getProtoPath('alumnos.proto'),
          url: 'localhost:5002',
          loader: { keepCase: true }, // 🔥 LÍNEA MÁGICA RECEPTORA
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
