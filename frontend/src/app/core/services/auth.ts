import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  // Devuelve 'true' si hay un token, 'false' si no lo hay
  estaLogueado(): boolean {
    return !!localStorage.getItem('token');
  }
}