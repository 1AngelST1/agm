import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Obtenemos los roles que requiere la ruta (ej. 'admin', 'docente')
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    // Si la ruta no tiene el decorador @Roles, dejamos pasar a todos
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 🔥 LA SOLUCIÓN: Extraemos el rol buscando en inglés o en español
    const userRole = user?.role || user?.rol;

    // 2. Verificamos si el rol del usuario está en la lista de permitidos
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException(`Acceso denegado. Se requiere rol: ${requiredRoles.join(' o ')}`);
    }

    return true;
  }
}