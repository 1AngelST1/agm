import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si tiene token, lo dejamos pasar a la vista
  if (authService.estaLogueado()) {
    return true;
  } 
  
  // Si no tiene token, lo pateamos de regreso al login
  router.navigate(['/login']);
  return false;
};