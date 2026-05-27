/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './app.service';
import { CreatePeriodoDto, CreateMateriaDto } from './dtos';
import { Periodo } from './periodo.entity';
import { Materia } from './materia.entity';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RabbitMQService } from './rabbitmq.service';
import { PeriodoIniciadoEvent, PeriodoFinalizadoEvent } from '@shared/events.types';
import { RABBITMQ_ROUTING_KEYS } from '@shared/rabbitmq.constants';

// Definimos una interfaz para tipar los datos entrantes de gRPC y evitar el uso de 'any'
interface GetMateriaRequest {
  nrc?: string;
}

@Controller('periodos')
export class AppController {
  private logger = new Logger('PeriodosController');

  constructor(
    private readonly appService: AppService,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  // ==========================================
  // 🌐 ENDPOINTS REST (Para el Administrador)
  // ==========================================

  /**
   * ✅ Crear un nuevo periodo
   * Solo Administrador
   * Requiere: Token JWT en header Authorization
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async crear(@Body() dto: CreatePeriodoDto): Promise<Periodo> {
    return await this.appService.crearPeriodo(dto);
  }

  /**
   * ✅ Listar todos los periodos
   * Publico (sin autenticación)
   */
  @Get()
  async listarTodos(): Promise<Periodo[]> {
    return await this.appService.obtenerTodos();
  }

  /**
   * ✅ Obtener el periodo activo actual
   * Publico (sin autenticación)
   */
  @Get('activo')
  async verActivo(): Promise<Periodo> {
    return await this.appService.obtenerActivo();
  }

  /**
   * ✅ Activar un periodo (desactiva el anterior)
   * Solo Administrador
   * Requiere: Token JWT en header Authorization
   */
  @Put(':id/activar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async activar(@Param('id') id: string): Promise<Periodo> {
    return await this.appService.activarPeriodo(id);
  }

  /**
   * ✅ Eliminar un periodo
   * Solo Administrador
   * Requiere: Token JWT en header Authorization
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async borrar(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.appService.eliminar(id);
    return { success: true };
  }

  // ==========================================
  // 📚 ENDPOINTS REST DE MATERIAS
  // ==========================================

  /**
   * ✅ Crear una nueva materia
   * Solo Administrador
   * Requiere: Token JWT en header Authorization
   */
  @Post('materia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async crearMateria(@Body() dto: CreateMateriaDto): Promise<Materia> {
    return await this.appService.crearMateria(dto);
  }

  /**
   * ✅ Listar materias de un periodo
   * Publico (sin autenticación)
   */
  @Get(':id/materias')
  async listarMaterias(@Param('id') periodoId: string): Promise<Materia[]> {
    return await this.appService.obtenerMateriasPorPeriodo(periodoId);
  }

  // ==========================================
  // 🚀 MÉTODOS gRPC (Para otros microservicios)
  // ==========================================

  @GrpcMethod('PeriodosService', 'GetPeriodoActivo')
  async grpcGetPeriodoActivo(): Promise<Periodo> {
    try {
      return await this.appService.obtenerActivo();
    } catch {
      // Si no hay periodo activo, devolvemos un objeto vacío para que gRPC no crashee
      return {
        id: '',
        nombre: 'Sin Periodo Activo',
        fecha_inicio: '',
        fecha_fin: '',
        plan_estudios: '',
        activo: false,
      } as Periodo;
    }
  }

  @GrpcMethod('PeriodosService', 'GetMateriaById')
  async getMateriaById(data: GetMateriaRequest) {
    try {
      console.log('GetMateriaById recibido - data:', JSON.stringify(data));
      
      const nrc = data?.nrc;
      console.log('NRC extraído:', nrc);
      
      if (!nrc) {
        throw new Error('NRC no recibido en GetMateriaById');
      }
      
      // Buscar por NRC
      const materia = await this.appService.obtenerMateriaPorNrc(String(nrc));
      
      console.log('Materia encontrada:', materia.clave, '-', materia.nombre);
      
      return {
        clave: materia.clave,
        nombre: materia.nombre,
        creditos: 6.0,
      };
    } catch (error) {
      console.error('Error en GetMateriaById:', (error as Error).message);
      return {
        clave: '',
        nombre: 'Materia no encontrada',
        creditos: 0,
      };
    }
  }

  /**
   * ✅ POST /periodos/iniciar/:id
   * Iniciar un período (publica evento periodo.iniciado)
   * Solo Administrador
   */
  @Post('iniciar/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async iniciarPeriodo(@Param('id') id: string) {
    const periodo = await this.appService.obtenerPorId(id);
    
    if (!periodo) {
      throw new Error('Período no encontrado');
    }

    // 📤 Publicar evento periodo.iniciado
    const evento: PeriodoIniciadoEvent = {
      periodo_id: periodo.id,
      nombre: periodo.nombre,
      fecha_inicio: new Date(periodo.fecha_inicio),
      fecha_fin: new Date(periodo.fecha_fin),
      estado: 'activo'
    };

    await this.rabbitmqService.publishEvent(
      RABBITMQ_ROUTING_KEYS.PERIODO_INICIADO,
      evento,
    );

    this.logger.log(`📤 Evento periodo.iniciado publicado para período ${periodo.nombre}`);

    return {
      mensaje: 'Período iniciado correctamente',
      periodo: periodo.nombre,
    };
  }

  /**
   * ✅ POST /periodos/cerrar/:id
   * Cerrar un período (publica evento periodo.cerrado)
   * Solo Administrador
   */
  @Post('cerrar/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async cerrarPeriodo(@Param('id') id: string) {
    const periodo = await this.appService.obtenerPorId(id);
    
    if (!periodo) {
      throw new Error('Período no encontrado');
    }

    // 📤 Publicar evento periodo.cerrado
    const evento: PeriodoFinalizadoEvent = {
      periodo_id: periodo.id,
      nombre: periodo.nombre,
      fecha_cierre: new Date(),
    };

    await this.rabbitmqService.publishEvent(
      RABBITMQ_ROUTING_KEYS.PERIODO_FINALIZADO,
      evento,
    );

    this.logger.log(`📤 Evento periodo.finalizado publicado para período ${periodo.nombre}`);

    return {
      mensaje: 'Período finalizado correctamente',
      periodo: periodo.nombre,
      fecha_cierre: new Date(),
    };
  }
}