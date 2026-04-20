import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  http = inject(HttpClient);
  router = inject(Router);
  
  alumnoId = signal('');
  alumnoData = signal<any>(null);
  cargando = signal(false);
  error = signal('');

  buscarAlumno() {
    if (!this.alumnoId()) return;
    this.cargando.set(true);
    this.error.set('');
    this.alumnoData.set(null);

    this.http.get(`http://localhost:3002/alumnos/${this.alumnoId()}`).subscribe({
      next: (data) => {
        this.alumnoData.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Alumno no encontrado.');
        this.cargando.set(false);
      }
    });
  }

  cerrarSesion() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}