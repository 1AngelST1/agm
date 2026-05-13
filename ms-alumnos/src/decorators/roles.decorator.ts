import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 🎯 Decorador @Roles
 * Marca una ruta con los roles permitidos.
 * Uso: @Roles('admin', 'docente')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
