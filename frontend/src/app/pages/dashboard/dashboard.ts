import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  rolUsuario = signal('');
  emailUsuario = signal('');
  
  alumnoId = signal('');
  alumnoData = signal<any>(null);

  ngOnInit() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        this.rolUsuario.set(decoded.role); 
        this.emailUsuario.set(decoded.email);
      } catch (e) {
        this.salir();
      }
    }
  }

  consultar() {
    if (!this.alumnoId()) return;
    this.http.get(`http://localhost:3002/alumnos/${this.alumnoId()}`).subscribe({
      next: (data) => this.alumnoData.set(data),
      error: (err) => console.error('Error al consultar datos')
    });
  }

  salir() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}