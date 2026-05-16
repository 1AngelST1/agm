import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'asistencias',
      protoPath: join(__dirname, '../../proto/asistencias.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT || 5005}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3005);

  console.log(
    `MS-Asistencias (REST) escuchando en puerto ${process.env.PORT || 3005}`,
  );
  console.log(
    `MS-Asistencias (gRPC) escuchando en puerto ${process.env.GRPC_PORT || 5005}`,
  );
}

void bootstrap();
