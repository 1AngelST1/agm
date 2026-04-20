import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule], // En Angular 20 ya no ponemos standalone: true
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  http = inject(HttpClient);
  router = inject(Router);

  email = signal('');
  error = signal('');

  iniciarSesion() {
    if (!this.email()) return;
    this.error.set('');

    this.http.post('http://localhost:3001/auth/login', { email: this.email() }).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.access_token);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Correo no registrado o error de red.');
      }
    });
  }
}