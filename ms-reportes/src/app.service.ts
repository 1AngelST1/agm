/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */

import { Injectable, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices'; // 🔥 Aquí agregamos 'type'
import { lastValueFrom, Observable } from 'rxjs';
import * as ExcelJS from 'exceljs';

// Interfaz para callar a ESLint
interface AlumnoCalificado {
  matricula: string;
  nombreEstudiante?: string;
  nombre_estudiante?: string;
  calificacionExamen?: number;
  calificacion_examen?: number;
  calificacionTarea?: number;
  calificacion_tarea?: number;
  calificacionProyecto?: number;
  calificacion_proyecto?: number;
  promedioPonderado?: number;
  promedio_ponderado?: number;
  estatus: string;
}

interface CalificacionesService {
  getConcentrado(data: { nrc: string }): Observable<any>;
}

@Injectable()
export class AppService implements OnModuleInit {
  private calificacionesService!: CalificacionesService;

  constructor(
    @Inject('CALIFICACIONES_SERVICE') private calificacionesClient: ClientGrpc,
    @Inject('ALUMNOS_SERVICE') private alumnosClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.calificacionesService =
      this.calificacionesClient.getService<CalificacionesService>('CalificacionesService');
  }

  async generarExcelCalificaciones(nrc: string): Promise<ExcelJS.Workbook> {
    try {
      console.log(`📊 Solicitando datos a Calificaciones para NRC: ${nrc}...`);

      const concentradoData = await lastValueFrom(
        this.calificacionesService.getConcentrado({ nrc }),
      );

      console.log('📦 CONCENTRADO DATA RECIBIDO:', JSON.stringify(concentradoData, null, 2));
      console.log('📦 Keys en concentradoData:', Object.keys(concentradoData || {}));
      console.log('📦 calificaciones:', concentradoData?.calificaciones);
      console.log('📦 numero de calificaciones:', concentradoData?.calificaciones?.length);

      if (!concentradoData || !concentradoData.calificaciones) {
        throw new Error(`No se encontraron datos para este grupo. Datos: ${JSON.stringify(concentradoData)}`);
      }

      console.log('✅ Datos recibidos, dibujando Excel...');

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema AGM BUAP';
      const worksheet = workbook.addWorksheet(`Acta - ${nrc}`);

      worksheet.columns = [
        { header: 'Matrícula', key: 'matricula', width: 15 },
        { header: 'Nombre del Alumno', key: 'nombre', width: 40 },
        { header: 'Examen', key: 'examen', width: 12 },
        { header: 'Tareas', key: 'tarea', width: 12 },
        { header: 'Proyecto', key: 'proyecto', width: 12 },
        { header: 'Prom. Final', key: 'promedio', width: 15 },
        { header: 'Estatus', key: 'estatus', width: 15 },
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF003B5C' },
      };
      worksheet.getRow(1).alignment = { horizontal: 'center' };

      const alumnos: AlumnoCalificado[] = concentradoData.calificaciones;
      
      alumnos.forEach((alumno) => {
        // 🔥 Protobuf convierte snake_case a camelCase en JavaScript
        worksheet.addRow({
          matricula: alumno.matricula,
          nombre: alumno.nombreEstudiante || alumno.nombre_estudiante,
          examen: alumno.calificacionExamen || alumno.calificacion_examen,
          tarea: alumno.calificacionTarea || alumno.calificacion_tarea,
          proyecto: alumno.calificacionProyecto || alumno.calificacion_proyecto,
          promedio: alumno.promedioPonderado || alumno.promedio_ponderado,
          estatus: alumno.estatus,
        });
      });

      return workbook;
    } catch (error) {
      console.error('❌ Error generando Excel:', (error as Error).message);
      throw new HttpException(
        'Error generando reporte',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}