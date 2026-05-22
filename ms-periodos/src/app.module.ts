import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as path from 'path';
import { Periodo } from './periodo.entity';
import { Materia } from './materia.entity';

// Función para obtener la ruta de los .proto
const getProtoPath = (protoFile: string) => {
  if (process.env.NODE_ENV === 'production') {
    return `/app/proto/${protoFile}`;
  }
  const proto = path.join(__dirname, `../../proto/${protoFile}`);
  console.log(`🔧 [ms-periodos] Cargando proto: ${proto}`);
  return proto;
};

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_periodos_db',
      entities: [Periodo, Materia],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Periodo, Materia]),

    // 🔥 AQUÍ AGREGAMOS LOS CLIENTES GRPC
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE', // 👈 ¡Este es el que pedía a gritos el JwtAuthGuard!
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: getProtoPath('auth.proto'),
          url: 'localhost:5000', // El puerto donde vive ms-auth
          loader: { keepCase: true },
        },
      },
      {
        name: 'CALIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'calificaciones',
          protoPath: getProtoPath('calificaciones.proto'),
          url: 'localhost:5003',
          loader: { keepCase: true },
        },
      },
      {
        name: 'ALUMNOS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: getProtoPath('alumnos.proto'),
          url: 'localhost:5002',
          loader: { keepCase: true },
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
