export class CreateGrupoDto {
  nrc!: string;
  materia_clave!: string;
  seccion!: string;
  periodo!: string;
  // 💡 docente_id se obtiene del token JWT, no del body
}
