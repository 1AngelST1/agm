import { Injectable, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  usuarioActual = signal<any>(null);
  
  constructor() {
    this.cargarUsuarioDelToken();
  }

  // Cargar usuario del token al inicializar
  private cargarUsuarioDelToken() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        this.usuarioActual.set({
          id: decoded.sub,
          email: decoded.email,
          rol: decoded.role
        });
      } catch (e) {
        console.error('Error al decodificar token', e);
      }
    }
  }

  // Devuelve 'true' si hay un token, 'false' si no lo hay
  estaLogueado(): boolean {
    return !!localStorage.getItem('token');
  }

  // Obtener ID del usuario actual
  obtenerIdUsuarioActual(): string | null {
    return this.usuarioActual()?.id || null;
  }

  // Obtener rol del usuario actual
  obtenerRolActual(): string | null {
    return this.usuarioActual()?.rol || null;
  }

  // Obtener email del usuario actual
  obtenerEmailActual(): string | null {
    return this.usuarioActual()?.email || null;
  }

  // Obtener usuario completo
  obtenerUsuarioActual(): any {
    return this.usuarioActual();
  }

  // Logout
  logout(): void {
    localStorage.removeItem('token');
    this.usuarioActual.set(null);
  }
}