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
}
