import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <--- Importa TypeOrmModule aquí
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
    TypeOrmModule.forFeature([User]), // <--- Agrega el repositorio de User aquí
    // 2. Configura el JWT
    JwtModule.register({
      secret: 'AGM-AST', // En la vida real esto va en un archivo .env
      signOptions: { expiresIn: '2h' }, // El token durará 2 horas
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
