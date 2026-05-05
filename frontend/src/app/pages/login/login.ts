import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);

  email = signal('');
  password = signal(''); 
  error = signal('');

  iniciarSesion() {
    if (!this.email() || !this.password()) return;
    this.error.set('');

    this.http.post('http://localhost:3001/auth/login', { 
      email: this.email(),
      password: this.password() 
    }, { observe: 'response' }).subscribe({
      next: (fullResponse: any) => {
        const res = fullResponse.body;
        localStorage.setItem('token', res.access_token);
        
        // Decodificar token para obtener el rol
        try {
          const decoded: any = jwtDecode(res.access_token);
          
          // Guardar usuario en el AuthService
          this.authService.usuarioActual.set({
            id: decoded.sub,
            email: decoded.email,
            rol: decoded.role
          });
          
          // Mapear roles del backend al frontend
          let rol = decoded.role.toUpperCase();
          if (rol === 'DOCENTE') {
            rol = 'PROFESOR'; // Convertir docente a profesor
          }

          // Redirigir según el rol
          if (rol === 'ADMIN') {
            this.router.navigate(['/admin']);
          } else if (rol === 'PROFESOR') {
            this.router.navigate(['/profesor']);
          } else if (rol === 'ALUMNO') {
            this.router.navigate(['/alumno']);
          } else {
            this.router.navigate(['/login']);
          }
        } catch (e) {
          console.error('Error al decodificar token', e);
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        console.error('❌ Error de login:', err);
        this.error.set('Credenciales inválidas o correo no registrado.');
      }
    });
  }
}