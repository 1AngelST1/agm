import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001);

  // Instancia gRPC
  const grpcApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'auth',
        protoPath: '/app/proto/auth.proto',
        url: '0.0.0.0:5000',
      },
    },
  );
  await grpcApp.listen();

  // --- LOS MENSAJES AL FINAL PARA QUE ESTÉN JUNTOS ---
  console.log('ms-auth REST escuchando en puerto 3001');
  console.log('ms-auth gRPC escuchando en puerto 5000');
}

bootstrap().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
