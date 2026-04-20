import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [FormsModule], // Agregamos FormsModule para poder usar el input
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  http = inject(HttpClient);
  
  // Nuestras Signals (Estado)
  alumnoId = signal('');
  alumnoData = signal<any>(null);
  cargando = signal(false);
  error = signal('');

  buscarAlumno() {
    if (!this.alumnoId()) return;

    this.cargando.set(true);
    this.error.set('');
    this.alumnoData.set(null);

    // Petición a tu ms-alumnos
    this.http.get(`http://localhost:3002/alumnos/${this.alumnoId()}`).subscribe({
      next: (data) => {
        this.alumnoData.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Alumno no encontrado o error de conexión.');
        this.cargando.set(false);
      }
    });
  }
}