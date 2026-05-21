import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CALIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'calificaciones',
          protoPath: join(__dirname, '../../proto/calificaciones.proto'), // Ajusta la ruta a tus protos globales
          url: 'localhost:5003',
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: join(__dirname, '../../proto/alumnos.proto'), // Ajusta la ruta a tus protos globales
          url: 'localhost:5002',
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
