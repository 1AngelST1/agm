import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './app.service';
import { CreatePeriodoDto, CreateMateriaDto } from './dtos';
import { Periodo } from './periodo.entity';
import { Materia } from './materia.entity';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('periodos')
export class AppController {
  constructor(private readonly appService: AppService) {}

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
  async getMateriaById(data: { materia_id: string }) {
    try {
      // Buscar por NRC (el materia_id es el NRC en tu sistema)
      const materia = await this.appService.obtenerMateriaPorNrc(
        data.materia_id,
      );
      return {
        clave: materia.clave,
        nombre: materia.nombre,
        creditos: 6.0, // Valor estándar según los PDFs académicos
      };
    } catch {
      // Si no existe, retornamos un objeto vacío para que gRPC no crashee
      return {
        clave: '',
        nombre: 'Materia no encontrada',
        creditos: 0,
      };
    }
  }
}
