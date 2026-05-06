import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CalificacionesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3003/calificaciones';

  // 👨‍🏫 Obtener mis grupos (para profesores)
  obtenerMisGrupos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mis-grupos`).pipe(
      catchError((error) => {
        console.error('Error al obtener mis grupos:', error);
        return throwError(() => error);
      })
    );
  }

  // 👥 Obtener alumnos de un grupo
  obtenerAlumnosDelGrupo(nrc: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/grupo/${nrc}/alumnos`).pipe(
      catchError((error) => {
        console.error('Error al obtener alumnos del grupo:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtener todos los grupos
  obtenerGrupos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/grupos`).pipe(
      catchError((error) => {
        console.error('Error al obtener grupos:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtener grupo por NRC
  obtenerGrupoPorNrc(nrc: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/grupo/${nrc}`).pipe(
      catchError((error) => {
        console.error('Error al obtener grupo:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtener materias
  obtenerMaterias(): Observable<any> {
    return this.http.get(`${this.apiUrl}/materias`).pipe(
      catchError((error) => {
        console.error('Error al obtener materias:', error);
        return throwError(() => error);
      })
    );
  }

  // 📝 CREAR calificación (Insertar nueva calificación)
  crearCalificacion(data: { nrc_grupo: string; matricula_alumno: string; calificacion_ordinaria: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/calificar`, data).pipe(
      catchError((error) => {
        console.error('Error al crear calificación:', error);
        return throwError(() => error);
      })
    );
  }

  // ✏️ ACTUALIZAR calificación (Editar)
  actualizarCalificacion(nrc: string, matricula: string, data: { calificacion_ordinaria: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/${nrc}/${matricula}`, data).pipe(
      catchError((error) => {
        console.error('Error al actualizar calificación:', error);
        return throwError(() => error);
      })
    );
  }

  // 🗑️ ELIMINAR calificación
  eliminarCalificacion(nrc: string, matricula: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${nrc}/${matricula}`).pipe(
      catchError((error) => {
        console.error('Error al eliminar calificación:', error);
        return throwError(() => error);
      })
    );
  }

  // 📖 OBTENER MI KARDEX (Para alumnos - Ver sus propias calificaciones)
  obtenerMiKardex(): Observable<any> {
    return this.http.get(`${this.apiUrl}/kardex/mi-kardex`).pipe(
      catchError((error) => {
        console.error('Error al obtener mi kardex:', error);
        return throwError(() => error);
      })
    );
  }

  // 📖 OBTENER KARDEX DE OTRO ALUMNO (Para admins y docentes)
  obtenerKardexAlumno(matricula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/kardex/${matricula}`).pipe(
      catchError((error) => {
        console.error('Error al obtener kardex del alumno:', error);
        return throwError(() => error);
      })
    );
  }
}
