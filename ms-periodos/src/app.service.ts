import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Periodo } from './periodo.entity';
import { Materia } from './materia.entity';
import { CreatePeriodoDto, CreateMateriaDto } from './dtos';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Periodo)
    private periodoRepository: Repository<Periodo>,
    @InjectRepository(Materia)
    private materiaRepository: Repository<Materia>,
  ) {}

  async crearPeriodo(dto: CreatePeriodoDto): Promise<Periodo> {
    const existe = await this.periodoRepository.findOne({
      where: { nombre: dto.nombre },
    });
    if (existe) {
      throw new BadRequestException(`El periodo ${dto.nombre} ya existe.`);
    }
    const nuevo = this.periodoRepository.create(dto);
    return await this.periodoRepository.save(nuevo);
  }

  async obtenerTodos(): Promise<Periodo[]> {
    return await this.periodoRepository.find({
      order: { fecha_inicio: 'DESC' },
    });
  }

  async obtenerActivo(): Promise<Periodo> {
    const activo = await this.periodoRepository.findOne({
      where: { activo: true },
    });
    if (!activo) {
      throw new NotFoundException(
        'No hay ningún periodo activo en este momento.',
      );
    }
    return activo;
  }

  async activarPeriodo(id: string): Promise<Periodo> {
    const periodo = await this.periodoRepository.findOne({ where: { id } });
    if (!periodo) throw new NotFoundException('Periodo no encontrado');

    // 1. Buscamos si hay un periodo activo actualmente
    const periodoActivo = await this.periodoRepository.findOne({
      where: { activo: true },
    });

    // 2. Si existe uno activo, lo desactivamos primero
    if (periodoActivo) {
      periodoActivo.activo = false;
      await this.periodoRepository.save(periodoActivo);
    }

    // 3. Encendemos el nuevo periodo
    periodo.activo = true;
    return await this.periodoRepository.save(periodo);
  }

  async eliminar(id: string): Promise<void> {
    const resultado = await this.periodoRepository.delete(id);
    if (resultado.affected === 0) {
      throw new NotFoundException('Periodo no encontrado');
    }
  }

  // ==========================================
  // 📚 MÉTODOS DE MATERIAS
  // ==========================================

  async crearMateria(dto: CreateMateriaDto): Promise<Materia> {
    const periodo = await this.periodoRepository.findOne({
      where: { id: dto.periodoId },
    });
    if (!periodo) {
      throw new NotFoundException('El periodo especificado no existe');
    }

    const nuevaMateria = this.materiaRepository.create({
      ...dto,
      periodo_id: dto.periodoId,
    });
    return await this.materiaRepository.save(nuevaMateria);
  }

  async obtenerMateriasPorPeriodo(periodoId: string): Promise<Materia[]> {
    return await this.materiaRepository.find({
      where: { periodo_id: periodoId },
      order: { clave: 'ASC' },
    });
  }

  async obtenerMateriaPorNrc(nrc: string): Promise<Materia> {
    const materia = await this.materiaRepository.findOne({ where: { nrc } });
    if (!materia) {
      throw new NotFoundException(`Materia con NRC ${nrc} no encontrada`);
    }
    return materia;
  }
}
