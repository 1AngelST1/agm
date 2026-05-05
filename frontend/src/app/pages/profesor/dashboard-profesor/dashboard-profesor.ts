import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth';
import { CalificacionesService } from '../../../core/services/calificaciones.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-profesor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-profesor.html',
  styleUrl: './dashboard-profesor.scss',
})
export class DashboardProfesor implements OnInit {
  private authService = inject(AuthService);
  private calificacionesService = inject(CalificacionesService);
  private router = inject(Router);

  // Signals
  usuario = this.authService.usuarioActual;
  misGrupos = signal<any>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.cargarMisGrupos();
  }

  cargarMisGrupos() {
    this.cargando.set(true);
    this.error.set(null);

    this.calificacionesService.obtenerMisGrupos().subscribe({
      next: (res: any) => {
        this.misGrupos.set(res);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar grupos:', err);
        this.error.set('Error al cargar tus grupos. Intenta más tarde.');
        this.cargando.set(false);
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
