export interface CrearUsuarioDto {
  name: string;
  email: string;
  password: string;
  role?: string; // Opcional: solo para admin creando otros admins
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CrearAdminDto {
  name: string;
  email: string;
  password: string;
}
