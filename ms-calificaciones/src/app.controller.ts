import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { Request } from 'express';
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
  UpdateCalificacionDto,
} from './dtos';

// Tipos para las solicitudes
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: 'admin' | 'docente' | 'alumno';
  };
}

// Interfaces para que TypeScript sepa qué métodos tienen los otros microservicios
interface AuthServiceClient {
  GetUserById(data: { user_id: string }): any;
}

interface AlumnosServiceClient {
  GetAlumnoByMatricula(data: { matricula: string }): any;
  GetAlumnoByUserId(data: { user_id: string }): any;
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
    } catch (error: unknown) {
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
  async crearGrupo(@Body() dto: CreateGrupoDto, @Req() req: AuthenticatedRequest) {
    try {
      // 🛡️ 1. AUTORIZACIÓN: Solo admin o docentes pueden crear grupos
      if (req.user.role !== 'admin' && req.user.role !== 'docente') {
        throw new UnauthorizedException(
          `¡Acceso denegado! Solo administradores y docentes pueden crear grupos. Tu rol es: ${req.user.role}`,
        );
      }

      // � El docente_id se obtiene del token JWT (usuario autenticado)
      const docenteId = req.user.userId;

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
        docente_id: docenteId,
        seccion: dto.seccion,
        periodo: dto.periodo,
      });

      return await this.grupoRepository.save(nuevoGrupo);
    } catch (error: unknown) {
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
  async calificarAlumno(@Body() dto: CreateCalificacionDto, @Req() req: AuthenticatedRequest) {
    console.log('📝 Recibido POST /calificar con:', dto);
    try {
      console.log('1️⃣ Verificando autorización del usuario:', req.user.role);
      
      // 🛡️ 1. AUTORIZACIÓN: Solo admin o docentes pueden calificar
      if (req.user.role !== 'admin' && req.user.role !== 'docente') {
        throw new UnauthorizedException(
          `¡Acceso denegado! Solo administradores y docentes pueden calificar. Tu rol es: ${req.user.role}`,
        );
      }

      console.log('2️⃣ Buscando grupo con NRC:', dto.nrc_grupo);
      
      // 2. VALIDACIÓN: El grupo debe existir
      const grupo = await this.grupoRepository.findOne({
        where: { nrc: dto.nrc_grupo },
        relations: ['materia'],
      });

      if (!grupo) {
        throw new NotFoundException(
          `El grupo con NRC ${dto.nrc_grupo} no existe.`,
        );
      }

      console.log('3️⃣ Grupo encontrado:', grupo.nrc);
      console.log('4️⃣ Validando matrícula del alumno con gRPC...');

      // 3. VALIDACIÓN gRPC: ¿EL ALUMNO EXISTE EN MS-ALUMNOS?
      let alumno: any;
      try {
        alumno = await firstValueFrom(
          this.alumnosService.GetAlumnoByMatricula({ matricula: dto.matricula_alumno }),
        );

        if (!alumno) {
          throw new BadRequestException(
            `El alumno con matrícula ${dto.matricula_alumno} no fue encontrado en ms-alumnos.`,
          );
        }

        console.log('✅ Alumno validado correctamente:', alumno.matricula);
      } catch (grpcError: unknown) {
        if (grpcError instanceof BadRequestException) {
          throw grpcError;
        }
        throw new BadRequestException(
          'Error gRPC (Alumnos): No se pudo validar la matrícula del alumno.',
        );
      }

      console.log('5️⃣ Validando que no exista calificación duplicada...');

      // 4. VALIDACIÓN: Verificar que el alumno no tiene ya una calificación en este grupo
      const calificacionExistente = await this.calificacionRepository.findOne({
        where: {
          matricula_alumno: dto.matricula_alumno,
          grupo: { nrc: dto.nrc_grupo },
        },
      });

      if (calificacionExistente) {
        throw new BadRequestException(
          `Este alumno ya tiene una calificación registrada en el grupo ${dto.nrc_grupo}. Usa PUT para editar la calificación existente.`,
        );
      }

      console.log('6️⃣ Calculando estatus con calificación:', dto.calificacion_ordinaria);

      // 5. Determinar estatus según la calificación
      let estatus = 'Cursando';
      if (dto.calificacion_ordinaria >= 6) {
        estatus = 'Aprobado';
      } else if (dto.calificacion_ordinaria > 0) {
        estatus = 'Reprobado';
      }

      console.log('7️⃣ Creando calificación con estatus:', estatus);

      // 5. Guardar la calificación
      const nuevaCalificacion = this.calificacionRepository.create({
        grupo: grupo,
        matricula_alumno: dto.matricula_alumno,
        calificacion_ordinaria: dto.calificacion_ordinaria,
        estatus: estatus,
      });

      console.log('8️⃣ Guardando en BD...');
      const resultado = await this.calificacionRepository.save(nuevaCalificacion);
      
      console.log('✅ Calificación guardada exitosamente:', resultado.matricula_alumno, resultado.nrc_grupo);
      return resultado;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error capturado:', errorMessage);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al registrar calificación: ' + errorMessage);
    }
  }

  /**
   * EDITAR CALIFICACIÓN
   * PUT /calificaciones/:id
   * Permite a docentes y admins actualizar la calificación de un alumno
   */
  @Put(':nrc/:matricula')
  async actualizarCalificacion(
    @Param('nrc') nrc: string,
    @Param('matricula') matricula: string,
    @Body() dto: UpdateCalificacionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log('📝 Recibido PUT /calificaciones/:nrc/:matricula', { nrc, matricula });
    try {
      console.log('1️⃣ Verificando autorización del usuario:', req.user.role);

      // 🛡️ 1. AUTORIZACIÓN: Solo admin o docentes pueden editar calificaciones
      if (req.user.role !== 'admin' && req.user.role !== 'docente') {
        throw new UnauthorizedException(
          `¡Acceso denegado! Solo administradores y docentes pueden editar calificaciones. Tu rol es: ${req.user.role}`,
        );
      }

      console.log('2️⃣ Buscando calificación...');

      // 2. VALIDACIÓN: La calificación debe existir
      const calificacion = await this.calificacionRepository.findOne({
        where: { matricula_alumno: matricula, nrc_grupo: nrc },
        relations: ['grupo'],
      });

      if (!calificacion) {
        throw new NotFoundException(
          `La calificación no existe para alumno ${matricula} en grupo ${nrc}.`,
        );
      }

      console.log('3️⃣ Calificación encontrada. Verificando permisos del docente...');

      // 3. AUTORIZACIÓN EXTRA: Si es docente, debe ser el dueño del grupo
      if (req.user.role === 'docente' && calificacion.grupo.docente_id !== req.user.userId) {
        throw new UnauthorizedException(
          'No tienes permiso para editar calificaciones de otro docente.',
        );
      }

      console.log('4️⃣ Validando rango de calificación...');

      // 4. Validar rango de calificación
      if (dto.calificacion_ordinaria < 0 || dto.calificacion_ordinaria > 10) {
        throw new BadRequestException(
          'La calificación debe estar entre 0 y 10.',
        );
      }

      console.log('5️⃣ Calculando nuevo estatus...');

      // 5. Determinar nuevo estatus según la calificación
      let nuevoEstatus = 'Cursando';
      if (dto.calificacion_ordinaria >= 6) {
        nuevoEstatus = 'Aprobado';
      } else if (dto.calificacion_ordinaria > 0) {
        nuevoEstatus = 'Reprobado';
      }

      console.log('6️⃣ Actualizando calificación...');

      // 6. Actualizar la calificación
      calificacion.calificacion_ordinaria = dto.calificacion_ordinaria;
      calificacion.estatus = nuevoEstatus;

      console.log('7️⃣ Guardando cambios en BD...');
      const resultado = await this.calificacionRepository.save(calificacion);

      console.log('✅ Calificación actualizada exitosamente');
      return resultado;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error capturado:', errorMessage);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al actualizar calificación: ' + errorMessage);
    }
  }

  /**
   * ELIMINAR CALIFICACIÓN
   * DELETE /calificaciones/:id
   * Permite a docentes y admins eliminar una calificación (solo si es de su grupo)
   */
  @Delete(':nrc/:matricula')
  async eliminarCalificacion(
    @Param('nrc') nrc: string,
    @Param('matricula') matricula: string,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log('🗑️ Recibido DELETE /calificaciones/:nrc/:matricula', { nrc, matricula });
    try {
      console.log('1️⃣ Verificando autorización del usuario:', req.user.role);

      // 🛡️ 1. AUTORIZACIÓN: Solo admin o docentes pueden eliminar calificaciones
      if (req.user.role !== 'admin' && req.user.role !== 'docente') {
        throw new UnauthorizedException(
          `¡Acceso denegado! Solo administradores y docentes pueden eliminar calificaciones. Tu rol es: ${req.user.role}`,
        );
      }

      console.log('2️⃣ Buscando calificación...');

      // 2. VALIDACIÓN: La calificación debe existir
      const calificacion = await this.calificacionRepository.findOne({
        where: { matricula_alumno: matricula, nrc_grupo: nrc },
        relations: ['grupo'],
      });

      if (!calificacion) {
        throw new NotFoundException(
          `La calificación no existe para alumno ${matricula} en grupo ${nrc}.`,
        );
      }

      console.log('3️⃣ Calificación encontrada. Verificando permisos del docente...');

      // 3. AUTORIZACIÓN EXTRA: Si es docente, debe ser el dueño del grupo
      if (req.user.role === 'docente' && calificacion.grupo.docente_id !== req.user.userId) {
        throw new UnauthorizedException(
          'No tienes permiso para eliminar calificaciones de otro docente.',
        );
      }

      console.log('4️⃣ Eliminando calificación de la BD...');

      // 4. Eliminar la calificación
      await this.calificacionRepository.remove(calificacion);

      console.log('✅ Calificación eliminada exitosamente');
      return {
        message: 'Calificación eliminada exitosamente',
        matricula_alumno: matricula,
        nrc_grupo: nrc,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error capturado:', errorMessage);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al eliminar calificación: ' + errorMessage);
    }
  }

  // ============================================
  // 🔍 BUSCADORES PARA ANGULAR (Lo que el Frontend va a consumir)
  // ============================================

  /**
   * 1. BUSCADOR DEL ALUMNO: "Mi Kardex" (¡Va PRIMERO - Ruta estática!)
   * GET /calificaciones/kardex/mi-kardex
   * ⚠️  IMPORTANTE: Esta ruta DEBE estar antes de @Get('kardex/:matricula')
   *     porque NestJS evalúa rutas de arriba hacia abajo.
   */
  @Get('kardex/mi-kardex')
  async verMiKardex(@Req() req: AuthenticatedRequest) {
    // 🛡️ CANDADO: Solo alumnos (o admin) pueden ver su kardex
    if (req.user.role !== 'alumno' && req.user.role !== 'admin') {
      throw new UnauthorizedException(
        `¡Acceso denegado! Solo los alumnos pueden ver su kardex. Tu rol es: ${req.user.role}`,
      );
    }

    // 📌 Obtener la matrícula del alumno a través de gRPC
    const userId = req.user.userId;
    console.log('🔍 Buscando alumno con user_id:', userId);

    let alumno: any;
    try {
      alumno = await firstValueFrom(
        this.alumnosService.GetAlumnoByUserId({ user_id: userId }),
      );
      console.log('✅ Alumno encontrado:', alumno);
    } catch (err: unknown) {
      console.error('❌ Error gRPC al obtener alumno:', err);
      throw new NotFoundException(
        'No se encontró un registro de alumno para tu usuario',
      );
    }

    const matricula = alumno.matricula;

    const misCalificaciones = await this.calificacionRepository.find({
      where: { matricula_alumno: matricula },
      relations: ['grupo', 'grupo.materia'],
    });

    // Devolver array vacío si no hay calificaciones (en lugar de excepción)
    return misCalificaciones;
  }

  /**
   * 2. BUSCADOR PARA EL ADMIN: Ver kardex de CUALQUIER alumno (Va DESPUÉS)
   * GET /calificaciones/kardex/:matricula
   * 🛡️ Con validación extra: Un alumno NO puede ver el kardex de otro alumno
   */
  @Get('kardex/:matricula')
  async verKardexAdmin(
    @Param('matricula') matricula: string,
    @Req() req: AuthenticatedRequest,
  ) {
    // 🛡️ CANDADO EXTRA: Evita que un alumno curioso consulte la matrícula de otro alumno
    if (req.user.role === 'alumno' && req.user.userId !== matricula) {
      throw new UnauthorizedException(
        'Solo puedes consultar tu propio kardex. Para ver tu kardex, usa GET /calificaciones/kardex/mi-kardex',
      );
    }

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

  /**
   * 3. BUSCADOR DEL PROFESOR: "Mis Grupos"
   * GET /calificaciones/mis-grupos
   * Retorna todos los grupos donde el profesor autenticado imparte clases
   */
  @Get('mis-grupos')
  async obtenerMisGrupos(@Req() req: AuthenticatedRequest) {
    // 🛡️ CANDADO DE AUTORIZACIÓN: Solo docentes o admins pueden ver grupos
    if (req.user.role !== 'docente' && req.user.role !== 'admin') {
      throw new UnauthorizedException(
        `¡Acceso denegado! Solo los docentes pueden ver esta sección. Tu rol es: ${req.user.role}`,
      );
    }

    const docenteId = req.user.userId;

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
   * 4. BUSCADOR DE LISTA DE CLASE: "Alumnos de un Grupo"
   * GET /calificaciones/grupo/:nrc/alumnos
   */
  @Get('grupo/:nrc/alumnos')
  async obtenerListaClase(@Param('nrc') nrc: string, @Req() req: AuthenticatedRequest) {
    // 🛡️ CANDADO DE AUTORIZACIÓN: Solo docentes o admins pueden ver listas de clase
    if (req.user.role !== 'docente' && req.user.role !== 'admin') {
      throw new UnauthorizedException(
        `¡Acceso denegado! Solo los docentes pueden ver la lista de clase. Tu rol es: ${req.user.role}`,
      );
    }

    const docenteId = req.user.userId;

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
}
