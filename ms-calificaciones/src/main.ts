import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path';

// Determinar la ruta correcta del proto según el entorno
const getProtoPath = () => {
  // En desarrollo: ../../proto/calificaciones.proto (salir de ms-calificaciones/dist)
  // En producción Docker: /app/proto/calificaciones.proto
  if (process.env.NODE_ENV === 'production') {
    return '/app/proto/calificaciones.proto';
  }
  // En desarrollo, usar ruta relativa desde el directorio dist
  // Desde ms-calificaciones/dist/main.js necesitamos ../../proto/calificaciones.proto
  return path.join(__dirname, '../../proto/calificaciones.proto');
};

async function bootstrap() {
  // 1. Iniciamos la app tradicional para el REST API
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Habilitamos CORS para que el frontend pueda consumir esta API sin problemas

  // 2. Le "conectamos" el servidor gRPC en un puerto diferente al de Auth
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'calificaciones', 
      protoPath: getProtoPath(),
      url: '0.0.0.0:5003', // ms-auth usa 5000, ms-alumnos usa 5001, ms-calificaciones usa 5003
      loader: {keepCase: true}, // Para mantener los nombres de los campos tal cual en el proto
    },
  });

  // 3. Arrancamos ambos motores
  await app.startAllMicroservices(); // Prende el gRPC (5003)
  await app.listen(3003); // Prende el REST (3003)
  console.log(' ms-calificaciones REST escuchando en puerto 3003');
  console.log(' ms-calificaciones gRPC escuchando en puerto 5003');
}

bootstrap().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
