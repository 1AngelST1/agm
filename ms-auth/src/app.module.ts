import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TokenService } from './token.service';
import { User } from './user.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    // Aquí configuramos la conexión a tu base de datos en Docker
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
    // 2. Configura el JWT
    JwtModule.register({
      secret: 'AGM-AST',
      signOptions: { expiresIn: '2h' }, // El token durará 2 horas
    }),
  ],
  controllers: [AppController],
  providers: [AppService, TokenService],
})
export class AppModule {}
