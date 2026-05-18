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
      // gRPC retorna userId (camelCase) desde ms-auth
      (request as any).user = {
        userId: (result as any).userId,
        email: (result as any).email,
        role: (result as any).role,
      };
      return true;
    } catch {
      throw new ForbiddenException('Token inválido o expirado');
    }
  }
}
