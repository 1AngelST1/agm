import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service'; // (Si borraste este archivo, quita esta línea y quítalo de providers)
import { Alumno } from './alumno.entity';

@Module({
  imports: [
    // Conexión a BD propia para ms-alumnos
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'admin',
      password: 'adminpassword',
      database: 'agm_alumnos_db',
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
          protoPath: join(__dirname, '../../proto/auth.proto'),
          url: 'localhost:5000',
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
