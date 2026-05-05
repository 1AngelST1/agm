import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth';
import { AlumnosService } from '../../../core/services/alumnos.service';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-dashboard-alumno',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-alumno.html',
  styleUrl: './dashboard-alumno.scss',
})
export class DashboardAlumno implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alumnosService = inject(AlumnosService);

  // Signals para manejar los datos del alumno de forma reactiva
  datosAlumno = signal<any>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  
  usuario = this.authService.usuarioActual;

  ngOnInit() {
    this.cargarInformacionPersonal();
  }

  cargarInformacionPersonal() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.error.set('No hay sesión activa');
      this.cargando.set(false);
      return;
    }

    try {
      // Intentar obtener los datos del alumno actual usando /alumnos/me
      this.alumnosService.obtenerMiPerfil().subscribe({
        next: (res: any) => {
          this.datosAlumno.set(res);
          this.error.set(null);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error al obtener datos del alumno:', err);
          this.error.set('Error al cargar tus datos. Verifica que el backend esté funcionando.');
          this.cargando.set(false);
        }
      });
    } catch (error) {
      console.error('Error al decodificar el token:', error);
      this.error.set('Error de autenticación');
      this.cargando.set(false);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}