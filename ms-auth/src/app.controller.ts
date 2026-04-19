import { Controller, Get } from '@nestjs/common'; // <--- Importa Get aquí
import { GrpcMethod } from '@nestjs/microservices';

@Controller('auth') // <--- Ponle un prefijo a tu controlador
export class AppController {
  // Esta es la ruta para probar en Postman: GET http://localhost:3001/auth
  @Get()
  getStatus() {
    return { message: 'Microservicio de Auth activo y escuchando' };
  }

  @GrpcMethod('AuthService', 'ValidateToken')
  validateToken(data: { token: string }) {
    console.log('gRPC recibido: Validando token:', data.token);
    return {
      userId: '0705',
      email: 'angel@uni.mx',
      role: 'admin',
    };
  }

  @GrpcMethod('AuthService', 'GetUserById')
  getUserById(data: { userId: string }) {
    const userId = data.userId || '070525'; // Si no recibe ID, usa este por defecto
    console.log('gRPC recibido: Buscando usuario:', userId);
    return {
      userId: userId,
      name: 'Angel Sarmiento',
      email: 'angel@uni.mx',
    };
  }
}
