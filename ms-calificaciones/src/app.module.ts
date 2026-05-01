import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Materia } from './materia.entity';
import { Grupo } from './grupo.entity';
import { Calificacion } from './calificacion.entity';
import { JwtStrategy } from './auth/jwt.strategy';

// Determinar la ruta correcta del proto según el entorno
const getProtoPath = () => {
  // En desarrollo: ../../proto/auth.proto (salir de ms-calificaciones/dist)
  // En producción Docker: /app/proto/auth.proto
  if (process.env.NODE_ENV === 'production') {
    return '/app/proto/auth.proto';
  }
  // En desarrollo, usar ruta relativa desde el directorio dist
  // Desde ms-calificaciones/dist/app.module.js necesitamos ../../proto/auth.proto
  return path.join(__dirname, '../../proto/auth.proto');
};

@Module({
  imports: [
    // Configurar Passport para JWT
    PassportModule,

    // Conexión a BD propia para ms-calificaciones
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_calificaciones_db',
      entities: [Materia, Grupo, Calificacion],
      synchronize: true,
    }),
    // ¡ESTA ES LA LÍNEA MÁGICA QUE FALTABA!
    TypeOrmModule.forFeature([Materia, Grupo, Calificacion]),

    // Cliente para comunicarse con ms-auth vía gRPC
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: getProtoPath(),
          url: `${process.env.AUTH_GRPC_HOST || 'localhost'}:${process.env.AUTH_GRPC_PORT || '5000'}`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
