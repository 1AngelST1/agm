import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Inject,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';

import { Materia } from './materia.entity';
import { Grupo } from './grupo.entity';
import { Calificacion } from './calificacion.entity';
import {
  CreateMateriaDto,
  CreateGrupoDto,
  CreateCalificacionDto,
} from './dtos';

// Interfaces para que TypeScript sepa qué métodos tienen los otros microservicios
interface AuthServiceClient {
  GetUserById(data: { user_id: string }): any;
}

interface AlumnosServiceClient {
  GetAlumnoByMatricula(data: { matricula: string }): any;
}

@Controller('calificaciones')
@UseGuards(AuthGuard('jwt')) // 🛡️ CADENERO: Nadie entra sin Token a este microservicio
export class AppController implements OnModuleInit {
  private authService!: AuthServiceClient;
  private alumnosService!: AlumnosServiceClient;

  constructor(
    @InjectRepository(Materia) private materiaRepository: Repository<Materia>,
    @InjectRepository(Grupo) private grupoRepository: Repository<Grupo>,
    @InjectRepository(Calificacion)
    private calificacionRepository: Repository<Calificacion>,
    @Inject('AUTH_PACKAGE') private authClient: ClientGrpc,
    @Inject('ALUMNOS_PACKAGE') private alumnosClient: ClientGrpc,
  ) {}

  // Se ejecuta al arrancar el microservicio para instanciar las conexiones gRPC
  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>('AuthService');
    this.alumnosService = this.alumnosClient.getService<AlumnosServiceClient>('AlumnosService');
  }

  // ============================================
  // HEALTH CHECK (Público, sin protección)
  // ============================================
  @Get()
  @UseGuards() // Sin guarda
  getHello() {
    return {
      message: 'ms-calificaciones está funcionando en puerto 3003',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // MATERIAS (CATÁLOGO ESTÁTICO)
  // ============================================
  @Get('materias')
  async obtenerMaterias() {
    return await this.materiaRepository.find();
  }

  @Post('materia')
  async crearMateria(@Body() dto: CreateMateriaDto) {
    try {
      // Validar que no exista una materia con la misma clave
      const existe = await this.materiaRepository.findOne({
        where: { clave: dto.clave },
      });

      if (existe) {
        throw new BadRequestException(
          `Ya existe una materia con la clave ${dto.clave}`,
        );
      }

      const nuevaMateria = this.materiaRepository.create(dto);
      return await this.materiaRepository.save(nuevaMateria);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al crear materia');
    }
  }

  // ============================================
  // GRUPOS (PROGRAMACIÓN ACADÉMICA)
  // ============================================
  @Get('grupos')
  async obtenerGrupos() {
    return await this.grupoRepository.find({
      relations: ['materia'],
    });
  }

  @Get('grupo/:nrc')
  async obtenerGrupoPorNrc(@Param('nrc') nrc: string) {
    const grupo = await this.grupoRepository.findOne({
      where: { nrc },
      relations: ['materia'],
    });

    if (!grupo) {
      throw new NotFoundException(`Grupo con NRC ${nrc} no encontrado`);
    }

    return grupo;
  }

  @Post('grupo')
  async crearGrupo(@Body() dto: CreateGrupoDto, @Req() req: any) {
    try {
      // 🛡️ 1. AUTORIZACIÓN: Solo admin o docentes pueden crear grupos
      if (req.user.role !== 'admin' && req.user.role !== 'docente') {
        throw new UnauthorizedException(
          `¡Acceso denegado! Solo administradores y docentes pueden crear grupos. Tu rol es: ${req.user.role}`,
        );
      }

      // 🛑 VALIDACIÓN gRPC: ¿EL DOCENTE EXISTE EN MS-AUTH?
      let docente: any;
      try {
        docente = await firstValueFrom(
          this.authService.GetUserById({ user_id: dto.docente_id }),
        );

        if (!docente) {
          throw new BadRequestException(
            `El docente con ID ${dto.docente_id} no fue encontrado en ms-auth.`,
          );
        }

        if (docente.role !== 'docente') {
          throw new BadRequestException(
            `El usuario es un ${docente.role}, no un docente.`,
          );
        }
      } catch (grpcError) {
        if (grpcError instanceof BadRequestException) {
          throw grpcError;
        }
        throw new BadRequestException(
          'Error gRPC (Auth): No se pudo validar al docente.',
        );
      }

      // Verificar que la materia existe
      const materia = await this.materiaRepository.findOne({
        where: { clave: dto.materia_clave },
      });

      if (!materia) {
        throw new NotFoundException(
          `Materia con clave ${dto.materia_clave} no encontrada`,
        );
      }

      // Verificar que el NRC sea único
      const nrcExiste = await this.grupoRepository.findOne({
        where: { nrc: dto.nrc },
      });

      if (nrcExiste) {
        throw new BadRequestException(
          `Ya existe un grupo con el NRC ${dto.nrc}`,
        );
      }

      // Si pasó todas las validaciones, guardamos el grupo
      const nuevoGrupo = this.grupoRepository.create({
        nrc: dto.nrc,
        materia: materia,
        docente_id: dto.docente_id,
        seccion: dto.seccion,
        periodo: dto.periodo,
      });

      return await this.grupoRepository.save(nuevoGrupo);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al crear grupo');
    }
  }

  // ============================================
  // CALIFICACIONES (KARDEX)
  // ============================================
  @Post('calificar')
  async calificarAlumno(@Body() dto: CreateCalificacionDto, @Req() req: any) {
    try {
      // 🛡️ 1. AUTORIZACIÓN: Solo admin o docentes pueden calificar (prevenir que alumnos se pongan 10 a sí mismos)
      if (req.user.role !== 'admin' && req.user.role !== 'docente') {
        throw new UnauthorizedException(
          `¡Acceso denegado! Solo administradores y docentes pueden calificar. Tu rol es: ${req.user.role}`,
        );
      }

      // 🛑 VALIDACIÓN gRPC: ¿EL ALUMNO EXISTE EN MS-ALUMNOS?
      let alumno: any;
      try {
        alumno = await firstValueFrom(
          this.alumnosService.GetAlumnoByMatricula({
            matricula: dto.matricula_alumno,
          }),
        );

        if (!alumno || !alumno.matricula) {
          throw new BadRequestException(
            `La matrícula ${dto.matricula_alumno} no está registrada.`,
          );
        }
      } catch (grpcError) {
        if (grpcError instanceof BadRequestException) {
          throw grpcError;
        }
        throw new BadRequestException(
          'Error gRPC (Alumnos): No se pudo validar la matrícula.',
        );
      }

      // Validamos que el grupo exista antes de calificar
      const grupo = await this.grupoRepository.findOne({
        where: { nrc: dto.nrc_grupo },
        relations: ['materia'],
      });

      if (!grupo) {
        throw new NotFoundException(
          `El grupo con NRC ${dto.nrc_grupo} no existe.`,
        );
      }

      // Determinar estatus según la calificación
      let estatus = 'Cursando';
      if (dto.calificacion_ordinaria >= 6) {
        estatus = 'Aprobado';
      } else if (dto.calificacion_ordinaria > 0) {
        estatus = 'Reprobado';
      }

      // Si todo es correcto, guardamos la calificación
      const nuevaCalificacion = this.calificacionRepository.create({
        grupo: grupo,
        matricula_alumno: dto.matricula_alumno,
        calificacion_ordinaria: dto.calificacion_ordinaria,
        estatus: estatus,
      });

      return await this.calificacionRepository.save(nuevaCalificacion);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al registrar calificación');
    }
  }

  @Get('kardex/:matricula')
  async verKardex(@Param('matricula') matricula: string) {
    const calificaciones = await this.calificacionRepository.find({
      where: { matricula_alumno: matricula },
      relations: ['grupo', 'grupo.materia'],
    });

    if (!calificaciones.length) {
      throw new NotFoundException(
        `No se encontraron calificaciones para la matrícula: ${matricula}`,
      );
    }

    return calificaciones;
  }

  // ============================================
  // 🔍 BUSCADORES PARA ANGULAR (Lo que el Frontend va a consumir)
  // ============================================

  /**
   * 1. BUSCADOR DEL PROFESOR: "Mis Grupos"
   * GET /calificaciones/mis-grupos
   * Retorna todos los grupos donde el profesor autenticado imparte clases
   */
  @Get('mis-grupos')
  async obtenerMisGrupos(@Req() req: any) {
    // 🛡️ CANDADO DE AUTORIZACIÓN: Solo docentes o admins pueden ver grupos
    if (req.user.role !== 'docente' && req.user.role !== 'admin') {
      throw new UnauthorizedException(
        `¡Acceso denegado! Solo los docentes pueden ver esta sección. Tu rol es: ${req.user.role}`,
      );
    }

    const docenteId = req.user?.sub;

    const misGrupos = await this.grupoRepository.find({
      where: { docente_id: docenteId },
      relations: ['materia'],
    });

    return {
      message: misGrupos.length
        ? 'Grupos encontrados'
        : 'No tienes grupos asignados',
      total: misGrupos.length,
      grupos: misGrupos,
    };
  }

  /**
   * 2. BUSCADOR DE LISTA DE CLASE: "Alumnos de un Grupo"
   * GET /calificaciones/grupo/:nrc/alumnos
   */
  @Get('grupo/:nrc/alumnos')
  async obtenerListaClase(@Param('nrc') nrc: string, @Req() req: any) {
    // 🛡️ CANDADO DE AUTORIZACIÓN: Solo docentes o admins pueden ver listas de clase
    if (req.user.role !== 'docente' && req.user.role !== 'admin') {
      throw new UnauthorizedException(
        `¡Acceso denegado! Solo los docentes pueden ver la lista de clase. Tu rol es: ${req.user.role}`,
      );
    }

    const docenteId = req.user?.sub;

    const grupo = await this.grupoRepository.findOne({
      where: { nrc },
      relations: ['materia'],
    });

    if (!grupo) {
      throw new NotFoundException(`Grupo con NRC ${nrc} no encontrado`);
    }

    if (grupo.docente_id !== docenteId) {
      throw new BadRequestException(
        'No tienes permiso para ver los alumnos de este grupo',
      );
    }

    const listaClase = await this.calificacionRepository.find({
      where: { grupo: { nrc } },
      relations: ['grupo', 'grupo.materia'],
    });

    return {
      grupo: {
        nrc: grupo.nrc,
        materia: grupo.materia.nombre,
        seccion: grupo.seccion,
        periodo: grupo.periodo,
      },
      totalAlumnos: listaClase.length,
      alumnos: listaClase,
    };
  }

  /**
   * 3. BUSCADOR DEL ALUMNO: "Mi Kardex"
   * GET /calificaciones/kardex/mi-kardex
   */
  @Get('kardex/mi-kardex')
  verMiKardex(@Req() req: any) {
    // 🛡️ CANDADO DE AUTORIZACIÓN: Solo alumnos (o admin) pueden ver su kardex
    if (req.user.role !== 'alumno' && req.user.role !== 'admin') {
      throw new UnauthorizedException(
        `¡Acceso denegado! Solo los alumnos pueden ver el kardex. Tu rol es: ${req.user.role}`,
      );
    }

    const alumnoId = req.user?.sub;

    return {
      message:
        'Para ver tu kardex completo, usa GET /calificaciones/kardex/:matricula',
      userId: alumnoId,
    };
  }
}
