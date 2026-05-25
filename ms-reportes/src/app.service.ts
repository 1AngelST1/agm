/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */

import { Injectable, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';
import * as ExcelJS from 'exceljs';

// Interfaz para callar a ESLint
interface CalificacionesService {
  getConcentrado(data: { nrc: string }): Observable<any>;
}

interface AsistenciasService {
  getAsistenciasByAlumno(data: { matricula: string; nrc: string }): Observable<any>;
}

interface AlumnoCalificado {
  matricula: string;
  nombre_estudiante: string;
  calificacion_examen: number;
  calificacion_tarea: number;
  calificacion_proyecto: number;
  promedio_ponderado: number;
  estatus: string;
}

@Injectable()
export class AppService implements OnModuleInit {
  private calificacionesService!: CalificacionesService;
  private asistenciasService!: AsistenciasService;

  constructor(
    @Inject('CALIFICACIONES_SERVICE') private calificacionesClient: ClientGrpc,
    @Inject('ALUMNOS_SERVICE') private alumnosClient: ClientGrpc,
    @Inject('ASISTENCIAS_SERVICE') private asistenciasClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.calificacionesService =
      this.calificacionesClient.getService<CalificacionesService>('CalificacionesService');
    this.asistenciasService =
      this.asistenciasClient.getService<AsistenciasService>('AsistenciasService');
  }

  async generateReportGrpc(
    nrc: string,
    formato: string,
  ): Promise<{ file_bytes: Buffer; file_name: string }> {
    console.log(`📊 [gRPC] Generando reporte de ${formato} para NRC: ${nrc}`);

    try {
      const workbook = await this.generarExcelCalificaciones(nrc);
      const bufferData = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(bufferData as any);

      const fileName = `Acta_Calificaciones_${nrc}_${Date.now()}.${formato === 'xls' ? 'xlsx' : formato}`;

      console.log(`✅ [gRPC] Reporte generado: ${fileName} (${buffer.byteLength} bytes)`);

      return {
        file_bytes: buffer,
        file_name: fileName,
      };
    } catch (error) {
      console.error('❌ [gRPC] Error generando reporte:', (error as Error).message);
      throw new HttpException(
        'Error generando reporte',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generarExcelCalificaciones(nrc: string): Promise<ExcelJS.Workbook> {
    try {
      console.log(`📊 Solicitando datos a Calificaciones para NRC: ${nrc}...`);

      const concentradoData = await lastValueFrom(
        this.calificacionesService.getConcentrado({ nrc }),
      );

      if (!concentradoData || !concentradoData.calificaciones) {
        throw new Error('No se encontraron datos para este grupo');
      }

      console.log('✅ Datos recibidos, dibujando Excel...');

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema AGM BUAP';
      const worksheet = workbook.addWorksheet(`Acta - ${nrc}`);

      // 🔥 Obtenemos las ponderaciones que viajaron por gRPC
      const pond = concentradoData.ponderaciones;

      // 🔥 Inyectamos los porcentajes dinámicamente en los títulos
      worksheet.columns = [
        { header: 'Matrícula', key: 'matricula', width: 15 },
        { header: 'Nombre del Alumno', key: 'nombre', width: 40 },
        { header: `Examen (${pond.examen || 40}%)`, key: 'examen', width: 15 },
        { header: `Tareas (${pond.tarea || 30}%)`, key: 'tarea', width: 15 },
        { header: `Proyecto (${pond.proyecto || 30}%)`, key: 'proyecto', width: 15 },
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
        worksheet.addRow({
          matricula: alumno.matricula,
          nombre: alumno.nombre_estudiante,
          examen: alumno.calificacion_examen,
          tarea: alumno.calificacion_tarea,
          proyecto: alumno.calificacion_proyecto,
          promedio: alumno.promedio_ponderado,
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