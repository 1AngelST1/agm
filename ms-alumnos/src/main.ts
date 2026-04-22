import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // 1. Iniciamos la app tradicional para el REST API
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Habilitamos CORS para que el frontend pueda consumir esta API sin problemas

  // 2. Le "conectamos" el servidor gRPC en un puerto diferente al de Auth
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'alumnos', // Coincide con tu alumnos.proto
      protoPath: '/app/proto/alumnos.proto',
      url: 'localhost:5001', // ms-auth usa 5000, ms-alumnos usará 5001
    },
  });

  // 3. Arrancamos ambos motores
  await app.startAllMicroservices(); // Prende el gRPC (5001)
  await app.listen(3002); // Prende el REST (3002)
  console.log(' ms-alumnos REST escuchando en puerto 3002');
  console.log(' ms-alumnos gRPC escuchando en puerto 5001');
}

bootstrap().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
