import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  // 1. Instancia para REST (tu API común)
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);

  // 2. Instancia para gRPC (para los otros microservicios)
  const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'auth',
        protoPath: join(__dirname, '../../proto/auth.proto'), // ¡Ojo aquí! Apunta a la raíz
      },
    },
  );
  await grpcApp.listen();
}

bootstrap().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
