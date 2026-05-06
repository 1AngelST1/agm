import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth';
import { AlumnosService } from '../../../core/services/alumnos.service';
import { CalificacionesService } from '../../../core/services/calificaciones.service';
import { Router } from '@angular/router';

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
  private calificacionesService = inject(CalificacionesService);

  // Signals para manejar los datos del alumno de forma reactiva
  datosAlumno = signal<any>(null);
  kardex = signal<any[]>([]);
  cargandoAlumno = signal(true);
  cargandoKardex = signal(true);
  error = signal<string | null>(null);
  errorKardex = signal<string | null>(null);
  
  usuario = this.authService.usuarioActual;

  ngOnInit() {
    this.cargarInformacionPersonal();
    this.cargarKardex();
  }

  cargarInformacionPersonal() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.error.set('No hay sesión activa');
      this.cargandoAlumno.set(false);
      return;
    }

    try {
      // Intentar obtener los datos del alumno actual usando /alumnos/me
      this.alumnosService.obtenerMiPerfil().subscribe({
        next: (res: any) => {
          this.datosAlumno.set(res);
          this.error.set(null);
          this.cargandoAlumno.set(false);
        },
        error: (err) => {
          console.error('Error al obtener datos del alumno:', err);
          this.error.set('Error al cargar tus datos. Verifica que el backend esté funcionando.');
          this.cargandoAlumno.set(false);
        }
      });
    } catch (error) {
      console.error('Error al decodificar el token:', error);
      this.error.set('Error de autenticación');
      this.cargandoAlumno.set(false);
    }
  }

  cargarKardex() {
    this.cargandoKardex.set(true);
    this.errorKardex.set(null);

    this.calificacionesService.obtenerMiKardex().subscribe({
      next: (res: any) => {
        console.log('✅ Kardex cargado:', res);
        // res es un array - puede estar vacío o lleno
        if (Array.isArray(res)) {
          this.kardex.set(res);
        } else {
          // Fallback si el backend devuelve un objeto
          this.kardex.set(res.alumnos || []);
        }
        this.cargandoKardex.set(false);
      },
      error: (err) => {
        console.error('Error al obtener kardex:', err);
        // Si es 404 o error, mostrar array vacío
        this.errorKardex.set('No tienes calificaciones registradas aún.');
        this.kardex.set([]);
        this.cargandoKardex.set(false);
      }
    });
  }

  // Calcular promedio de calificaciones
  calcularPromedio(): number {
    const calificaciones = this.kardex() as any[];
    if (!calificaciones || calificaciones.length === 0) return 0;
    
    const suma = calificaciones.reduce((acc, cal) => acc + (cal.calificacion_ordinaria || 0), 0);
    return Math.round((suma / calificaciones.length) * 100) / 100;
  }

  // Contar aprobadas
  contar(estatus: string): number {
    const calificaciones = this.kardex() as any[];
    if (!calificaciones) return 0;
    return calificaciones.filter(cal => cal.estatus === estatus).length;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}