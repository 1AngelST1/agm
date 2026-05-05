import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode'; // Para leer el contenido del token

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  try {
    // Decodificamos el token para sacar el rol
    const decoded: any = jwtDecode(token);
    let userRole = decoded.role.toUpperCase(); // Convertir a mayúscula
    
    // Mapear roles del backend al frontend
    if (userRole === 'DOCENTE') {
      userRole = 'PROFESOR'; // Convertir docente a profesor
    }
    
    const expectedRole = route.data['expectedRole'];

    if (userRole === expectedRole) {
      return true; // ¡Pase VIP concedido!
    }

    // Si tiene el rol equivocado (ej: alumno queriendo entrar a admin)
    // Lo mandamos a su dashboard correspondiente
    const roleMap: { [key: string]: string } = {
      'ADMIN': 'admin',
      'PROFESOR': 'profesor',
      'ALUMNO': 'alumno'
    };
    const redirectPath = roleMap[userRole] || 'login';
    router.navigate([`/${redirectPath}`]);
    return false;
  } catch (error) {
    router.navigate(['/login']);
    return false;
  }
};