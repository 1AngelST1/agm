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
const getProtoPath = (protoFile: string) => {
  // En desarrollo: ../../proto/{protoFile} (salir de ms-calificaciones/dist)
  // En producción Docker: /app/proto/{protoFile}
  if (process.env.NODE_ENV === 'production') {
    return `/app/proto/${protoFile}`;
  }
  // En desarrollo, usar ruta relativa desde el directorio dist
  return path.join(__dirname, `../../proto/${protoFile}`);
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

    // 📞 CONEXIONES gRPC HACIA LOS OTROS MICROSERVICIOS
    ClientsModule.register([
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: getProtoPath('auth.proto'),
          url: `${process.env.AUTH_GRPC_HOST || 'localhost'}:${process.env.AUTH_GRPC_PORT || '5000'}`,
        },
      },
      {
        name: 'ALUMNOS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'alumnos',
          protoPath: getProtoPath('alumnos.proto'),
          url: `${process.env.ALUMNOS_GRPC_HOST || 'localhost'}:${process.env.ALUMNOS_GRPC_PORT || '5001'}`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
