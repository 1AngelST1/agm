import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface AuthServiceClient {
  ValidateToken(data: { token: string }): any;
}

interface ValidateTokenResponse {
  user_id: string;
  email: string;
  role: 'admin' | 'docente' | 'alumno';
}

@Injectable()
export class RolesGuard implements CanActivate, OnModuleInit {
  private authService!: AuthServiceClient;

  constructor(
    private reflector: Reflector,
    @Inject('AUTH_SERVICE') private authClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>(
      'AuthService',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1️⃣ Obtener los roles requeridos del decorador @Roles
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay roles definidos, dejar pasar (no hay restricción)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 2️⃣ Extraer el token del header Authorization
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization || '';

    if (!authHeader) {
      throw new ForbiddenException(
        'Se requiere autenticación para esta operación',
      );
    }

    const tokenParts = authHeader.split(' ');
    const token = tokenParts[1] || '';

    if (!token) {
      throw new ForbiddenException('Token no válido');
    }

    // 3️⃣ Validar el token contra ms-auth vía gRPC
    try {
      const result = await firstValueFrom(
        this.authService.ValidateToken({ token }),
      ) as ValidateTokenResponse;

      // 4️⃣ Verificar que el rol del usuario está en la lista de roles permitidos
      if (!requiredRoles.includes(result.role)) {
        throw new ForbiddenException(
          `Tu rol (${result.role}) no tiene permisos para realizar esta acción. Se requiere uno de: ${requiredRoles.join(', ')}`,
        );
      }

      // ✅ Todo bien, guardar el usuario en el request para usarlo después
      (request as any).user = result;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Token inválido o expirado');
    }
  }
}
