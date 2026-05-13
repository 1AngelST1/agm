import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  // 1. Iniciamos la app principal (REST)
  const app = await NestFactory.create(AppModule);

  // Activamos validaciones estrictas de DTOs
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // CORS para que Angular pueda conectarse después
  app.enableCors();

  // 2. Configuramos el canal gRPC
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'periodos',
      protoPath: join(__dirname, '../../proto/periodos.proto'),
      url: '0.0.0.0:5001', // Puerto exclusivo para gRPC
    },
  });

  // 3. Arrancamos ambos motores
  await app.startAllMicroservices();
  await app.listen(3001);

  console.log('MS-Periodos (REST) escuchando en puerto 3001');
  console.log('MS-Periodos (gRPC) escuchando en puerto 5001');
}

void bootstrap();
