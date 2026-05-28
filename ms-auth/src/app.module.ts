import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TokenService } from './token.service';
import { User } from './user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'adminpassword',
      database: process.env.DB_DATABASE || 'agm_auth_db',
      entities: [User],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User]),
    
    ClientsModule.register([
      {
        name: 'NOTIFICACIONES_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'notificaciones',
          protoPath: '/app/proto/notificaciones.proto',
          url: 'ms-notificaciones:5014', 
        },
      },
    ]),
    
    JwtModule.register({
      secret: 'AGM-AST',
      signOptions: { expiresIn: '2h' },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, TokenService],
})
export class AppModule {}