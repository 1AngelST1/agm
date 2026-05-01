import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

// Type guard sin apagar ESLint (Usando 'unknown' en lugar de 'any')
function isJwtPayload(obj: unknown): obj is JwtPayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sub' in obj &&
    typeof (obj as Record<string, unknown>).sub === 'string' &&
    'email' in obj &&
    typeof (obj as Record<string, unknown>).email === 'string' &&
    'role' in obj &&
    typeof (obj as Record<string, unknown>).role === 'string'
  );
}

@Injectable()
export class TokenService {
  constructor(private jwtService: JwtService) {}

  /**
   * Verifica un token, atrapa errores de expiración y retorna el payload validado
   */
  verifyToken(token: string): JwtPayload {
    try {
      // ✅ Solución al 'any': Le decimos explícitamente que es 'unknown'
      const payload = this.jwtService.verify(token) as unknown;

      if (!isJwtPayload(payload)) {
        // ✅ Solución a Prettier: Saltos de línea como le gusta al linter
        throw new UnauthorizedException(
          'El token no tiene la estructura requerida',
        );
      }

      return payload;
    } catch {
      // ✅ Solución al 'error' no usado: Simplemente usamos catch sin variable
      throw new UnauthorizedException('Token inválido o ha expirado');
    }
  }

  /**
   * Verifica si el token es de un admin
   */
  isAdminToken(token: string): boolean {
    try {
      const payload = this.verifyToken(token);
      return payload.role === 'admin';
    } catch {
      return false;
    }
  }
}
