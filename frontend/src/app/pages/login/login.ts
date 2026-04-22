import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private http = inject(HttpClient);
  private router = inject(Router);

  email = signal('');
  password = signal(''); 
  error = signal('');

  iniciarSesion() {
    if (!this.email() || !this.password()) return;
    this.error.set('');

    this.http.post('http://localhost:3001/auth/login', { 
      email: this.email(),
      password: this.password() 
    }).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.access_token);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set('Credenciales inválidas o correo no registrado.');
      }
    });
  }
}