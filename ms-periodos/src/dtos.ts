import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreatePeriodoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string = '';

  @IsDateString()
  @IsNotEmpty()
  fecha_inicio: string = '';

  @IsDateString()
  @IsNotEmpty()
  fecha_fin: string = '';

  @IsString()
  @IsNotEmpty()
  plan_estudios: string = '';
}

export class UpdatePeriodoDto {
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

export class CreateMateriaDto {
  @IsString()
  @IsNotEmpty()
  nrc: string = '';

  @IsString()
  @IsNotEmpty()
  clave: string = '';

  @IsString()
  @IsNotEmpty()
  nombre: string = '';

  @IsString()
  @IsNotEmpty()
  seccion: string = '';

  @IsOptional()
  @IsString()
  horario?: string;

  @IsOptional()
  @IsString()
  docente_asignado?: string;

  @IsString()
  @IsNotEmpty()
  periodoId: string = '';
}
