import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface AuthServiceClient {
  ValidateToken(data: { token: string }): any;
}

interface ValidateTokenResponse {
  user_id: string;
  email: string;
  role: 'admin' | 'docente' | 'alumno';
}

@Injectable()
export class JwtAuthGuard implements CanActivate, OnModuleInit {
  private authService!: AuthServiceClient;

  constructor(@Inject('AUTH_SERVICE') private authClient: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>(
      'AuthService',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization || '';

    if (!authHeader) {
      throw new ForbiddenException('Token no proporcionado');
    }

    const tokenParts = authHeader.split(' ');
    const token = tokenParts[1] || '';

    if (!token) {
      throw new ForbiddenException('Token no válido');
    }

    try {
      const result = await firstValueFrom(
        this.authService.ValidateToken({ token }),
      );
      
      // gRPC puede devolver snake_case (user_id) o camelCase (userId)
      const validatedUser = {
        user_id: (result as any).user_id || (result as any).userId,
        email: (result as any).email,
        role: (result as any).role,
      };
      
      console.log('✅ Guard received from gRPC:', result);
      console.log('✅ Guard normalized user:', validatedUser);
      
      (request as any).user = validatedUser;
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw new ForbiddenException('Token inválido o expirado');
    }
  }
}
