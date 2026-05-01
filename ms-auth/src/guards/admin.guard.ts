import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService, JwtPayload } from '../token.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
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

    try {
      const decoded = this.tokenService.verifyToken(token);
      if (decoded.role !== 'admin') {
        throw new ForbiddenException(
          'Solo los administradores pueden realizar esta acción',
        );
      }
      (request as unknown as { user: JwtPayload }).user = decoded;
      return true;
    } catch {
      throw new ForbiddenException('Token inválido o expirado');
    }
  }
}
