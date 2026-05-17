import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Levantamos el servidor gRPC de Alumnos para que Calificaciones/Asistencias le puedan hablar
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'alumnos',
      protoPath: join(__dirname, '../../proto/alumnos.proto'),
      url: '0.0.0.0:5002',
    },
  });

  await app.startAllMicroservices();
  await app.listen(3002);

  console.log('🚀 ms-alumnos REST escuchando en puerto 3002');
  console.log('📡 ms-alumnos gRPC escuchando en puerto 5002');
}
bootstrap().catch((err) => console.error(err));
