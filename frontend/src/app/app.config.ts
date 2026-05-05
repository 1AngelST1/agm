import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // 👈 Importa withInterceptors
import { authInterceptor } from './core/interceptors/auth.interceptor'; // 👈 Importa tu interceptor

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // 👇 ACTUALIZA ESTA LÍNEA
    provideHttpClient(
      withInterceptors([authInterceptor]) 
    ),
  ]
};