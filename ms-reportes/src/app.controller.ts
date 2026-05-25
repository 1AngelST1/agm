/* eslint-disable prettier/prettier */
import { Controller, Get, Param, Res, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './app.service';
import type { Response } from 'express';

@Controller('reportes')
export class AppController implements OnModuleInit {
  constructor(private readonly appService: AppService) {}

  onModuleInit() {
    console.log('✅ [MS-Reportes] Controlador gRPC inicializado');
  }

  @GrpcMethod('ReportesService', 'GenerateReport')
  async generateReport(data: { materia_id: string; formato: string }) {
    console.log(`📡 [gRPC] GenerateReport - NRC: ${data.materia_id}, Formato: ${data.formato}`);

    try {
      if (!data.materia_id || !data.formato) {
        throw new HttpException(
          'Parámetros requeridos: materia_id y formato',
          HttpStatus.BAD_REQUEST,
        );
      }

      const validFormatos = ['pdf', 'xls'];
      if (!validFormatos.includes(data.formato)) {
        throw new HttpException(
          `Formato no soportado: ${data.formato}. Soportados: ${validFormatos.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.appService.generateReportGrpc(
        data.materia_id,
        data.formato,
      );

      return {
        file_bytes: result.file_bytes,
        file_name: result.file_name,
      };
    } catch (error) {
      console.error('❌ [gRPC] Error en GenerateReport:', (error as Error).message);
      throw new HttpException(
        `Error generando reporte: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('calificaciones/:nrc')
  async descargarReporteCalificaciones(
    @Param('nrc') nrc: string,
    @Res() res: Response,
  ) {
    try {
      const workbook = await this.appService.generarExcelCalificaciones(nrc);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Acta_Calificaciones_${nrc}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.status(200).end();
    } catch (error) {
      console.error('Error al generar archivo:', error);
      res
        .status(500)
        .json({ success: false, message: 'No se pudo generar el reporte' });
    }
  }
} 