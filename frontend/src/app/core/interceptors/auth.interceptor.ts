import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Buscamos la llave en el almacenamiento
  const token = localStorage.getItem('token');
  
  if (token) {
    // Si hay llave, clonamos la petición y le pegamos el Token como un "Gafete VIP"
    const peticionClonada = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(peticionClonada);
  }
  
  // Si no hay llave, la mandamos así (para el login, por ejemplo)
  return next(req);
};