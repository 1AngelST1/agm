/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JwtAuthGrpcGuard implements CanActivate, OnModuleInit {
  private authService: any;

  constructor(@Inject('AUTH_SERVICE') private client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<any>('AuthService');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado o inválido');
    }

    const token = authHeader.split(' ')[1];

    try {
      const response: any = await firstValueFrom(
        this.authService.ValidateToken({ token }),
      );

      if (!response.valid) {
        throw new UnauthorizedException('Token expirado o inválido');
      }

      request.user = {
        userId: response.userId,
        rol: response.rol,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        'No autorizado por el servidor de autenticación',
      );
    }
  }
}
