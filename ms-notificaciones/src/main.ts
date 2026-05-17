import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  // 1. Instancia para REST (Puerto 3004)
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // 2. Instancia para gRPC (Puerto 5014)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'notificaciones',
      protoPath: join(__dirname, '../../proto/notificaciones.proto'),
      url: '0.0.0.0:5014', // 🔥 Sincronizado en 5014
    },
  });

  await app.startAllMicroservices();
  await app.listen(3004);

  console.log('🚀 ms-notificaciones REST escuchando en puerto 3004');
  console.log('📡 ms-notificaciones gRPC escuchando en puerto 5014');
}
bootstrap().catch((err) => console.error(err));
