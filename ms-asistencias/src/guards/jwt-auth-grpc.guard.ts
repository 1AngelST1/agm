import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

interface AuthServiceClient {
  ValidateToken(data: { token: string }): Observable<any>;
}

@Injectable()
export class JwtAuthGrpcGuard implements CanActivate, OnModuleInit {
  private authService!: AuthServiceClient;
  private logger = new Logger('JwtAuthGrpcGuard');

  constructor(@Inject('AUTH_SERVICE') private client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthServiceClient>('AuthService');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Falta el token de autorización');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Pedimos a ms-auth que valide el token
      const response = await firstValueFrom(this.authService.ValidateToken({ token }));
      
      if (!response || (!response.userId && !response.user_id)) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      // 🔥 Inyectamos los datos limpios para que el RolesGuard los pueda leer
      req.user = {
        userId: response.userId || response.user_id,
        email: response.email,
        role: response.role,
      };

      return true;
    } catch (error) {
      // Si algo falla, ahora sí lo veremos en letras rojas en la consola
      this.logger.error('❌ Error validando token en gRPC:', (error as Error).message);
      throw new UnauthorizedException('No autorizado por el servidor de autenticación');
    }
  }
}