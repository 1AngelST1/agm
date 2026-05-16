/* eslint-disable @typescript-eslint/no-unsafe-call */

import { IsString, IsNotEmpty } from 'class-validator';

export class GenerarQrDto {
  @IsString()
  @IsNotEmpty()
  nrc_materia!: string;
}

export class RegistrarAsistenciaDto {
  @IsString()
  @IsNotEmpty()
  token_qr!: string;

  @IsString()
  @IsNotEmpty()
  matricula_alumno!: string;
}
