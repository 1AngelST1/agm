import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path'; // 👈 1. IMPORTAR JOIN

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // 2. CONECTAR EL MICROSERVICIO (Más eficiente)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      // 👇 3. RUTA DINÁMICA CORREGIDA
      protoPath: join(process.cwd(), '../proto/auth.proto'),
      url: '0.0.0.0:5000',
    },
  });

  // 4. ARRANCAR AMBOS
  await app.startAllMicroservices();
  await app.listen(3000);

  console.log('ms-auth REST escuchando en puerto 3000');
  console.log('ms-auth gRPC escuchando en puerto 5000');
}

bootstrap().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
