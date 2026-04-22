import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { AppService } from './app.service'; // (Si borraste este archivo, quita esta línea y quítalo de providers)
import { Alumno } from './alumno.entity';
import { JwtStrategy } from './auth/jwt.strategy';

@Module({
  imports: [
    // Configurar Passport para JWT
    PassportModule,

    // Conexión a BD propia para ms-alumnos
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_alumnos_db',
      entities: [Alumno],
      synchronize: true,
    }),
    // ¡ESTA ES LA LÍNEA MÁGICA QUE FALTABA!
    TypeOrmModule.forFeature([Alumno]),

    // Cliente para comunicarse con ms-auth vía gRPC
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: '/app/proto/auth.proto',
          url: `${process.env.AUTH_GRPC_HOST || 'localhost'}:${process.env.AUTH_GRPC_PORT || '5000'}`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
