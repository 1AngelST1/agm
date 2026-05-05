import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AlumnosService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3002/alumnos';

  // Obtener información del alumno por ID
  obtenerAlumnoById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error('Error al obtener alumno:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtener datos del alumno actual (usando el JWT)
  obtenerMiPerfil(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`).pipe(
      catchError((error) => {
        console.error('Error al obtener mi perfil:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtener alumno por matrícula
  obtenerAlumnoPorMatricula(matricula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/matricula/${matricula}`).pipe(
      catchError((error) => {
        console.error('Error al obtener alumno por matrícula:', error);
        return throwError(() => error);
      })
    );
  }

  // Listar todos los alumnos (Admin)
  listarAlumnos(): Observable<any> {
    return this.http.get(this.apiUrl).pipe(
      catchError((error) => {
        console.error('Error al listar alumnos:', error);
        return throwError(() => error);
      })
    );
  }
}

