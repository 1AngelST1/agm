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
      host: 'localhost', // Como tu Node.js corre fuera de Docker, usa localhost
      port: 5432,
      username: 'admin', // Tu usuario por defecto
      password: 'adminpassword', // La contraseña que pusiste en el docker-compose
      database: 'agm_auth_db', // El nombre de la base de datos que creamos para auth
      entities: [User], // Aquí pondremos nuestras tablas más adelante
      synchronize: true, // ¡OJO! Esto crea las tablas automáticamente en desarrollo
    }),
    TypeOrmModule.forFeature([User]), // <--- Agrega el repositorio de User aquí
    // 2. Configura el JWT
    JwtModule.register({
      secret: 'mi_clave_secreta_agm', // En la vida real esto va en un archivo .env
      signOptions: { expiresIn: '2h' }, // El token durará 2 horas
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
