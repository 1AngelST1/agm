/* eslint-disable prettier/prettier */
import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express'; // 🔥 Aquí agregamos 'type'

@Controller('reportes')
export class AppController {
  constructor(private readonly appService: AppService) {}

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