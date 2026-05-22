import { OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import * as ExcelJS from 'exceljs';
export declare class AppService implements OnModuleInit {
    private calificacionesClient;
    private alumnosClient;
    private calificacionesService;
    constructor(calificacionesClient: ClientGrpc, alumnosClient: ClientGrpc);
    onModuleInit(): void;
    generarExcelCalificaciones(nrc: string): Promise<ExcelJS.Workbook>;
}
