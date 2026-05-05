import { Routes } from '@angular/router';
// Importa los componentes reales (ajusta las rutas según tu estructura de carpetas)
import { Login } from './pages/login/login'; 
import { DashboardAdmin } from './pages/admin/dashboard-admin/dashboard-admin';
import { DashboardProfesor } from './pages/profesor/dashboard-profesor/dashboard-profesor';
import { DashboardAlumno } from './pages/alumno/dashboard-alumno/dashboard-alumno';

// Importamos ambos Guards
import { authGuard } from './core/guards/auth-guard'; 
import { roleGuard } from './core/guards/role-guard'; 

export const routes: Routes = [
  { path: 'login', component: Login },
  
  // Rutas Protegidas: Primero checa que esté logueado y luego el Rol
  { 
    path: 'admin', 
    component: DashboardAdmin, 
    canActivate: [authGuard, roleGuard], 
    data: { expectedRole: 'ADMIN' } 
  },
  { 
    path: 'profesor', 
    component: DashboardProfesor, 
    canActivate: [authGuard, roleGuard], 
    data: { expectedRole: 'PROFESOR' } 
  },
  { 
    path: 'alumno', 
    component: DashboardAlumno, 
    canActivate: [authGuard, roleGuard], 
    data: { expectedRole: 'ALUMNO' } 
  },
  
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' } // Por si escriben cualquier cosa
];