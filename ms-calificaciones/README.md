# ms-calificaciones

Este es el microservicio encargado de gestionar las **calificaciones** de los alumnos.

## Estructura

- **Materias**: Catálogo de materias (clave, nombre, créditos)
- **Grupos**: Programación académica (NRC, materia, docente, sección, período)
- **Calificaciones**: Kardex de calificaciones por alumno

## Puertos

- **REST API**: `3003`
- **gRPC**: `5002`

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run start:dev
```

## Producción

```bash
npm run build
npm run start:prod
```
