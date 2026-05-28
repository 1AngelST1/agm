import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('MS-REPORTES');

  // 1. Crear la instancia principal para el servidor REST HTTP
  const app = await NestFactory.create(AppModule);
  // Habilitar CORS para permitir peticiones externas
  app.enableCors();

  // 2. Conectar el Microservicio gRPC de manera híbrida
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'reportes',
      protoPath: join(__dirname, '../../proto/reportes.proto'), // Apuntará a la carpeta de protos
      url: '0.0.0.0:5007', // Puerto asignado por convención gRPC para MS-7
    },
  });

  // Lanzar el motor gRPC interno
  await app.startAllMicroservices();
  logger.log('📡 Servidor gRPC escuchando en el puerto 5007');

  // Lanzar el servidor REST externo
  const restPort = 3007;
  await app.listen(restPort);
  logger.log(`🚀 Servidor REST escuchando en http://localhost:${restPort}`);
}
void bootstrap();
