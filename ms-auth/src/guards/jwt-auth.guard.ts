import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization || '';

    if (!authHeader) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const tokenParts = authHeader.split(' ');
    const token = tokenParts[1] || '';

    if (!token) {
      throw new UnauthorizedException('Token no válido');
    }

    try {
      const payload = this.tokenService.verifyToken(token);
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
