import { OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import * as ExcelJS from 'exceljs';
export declare class AppService implements OnModuleInit {
    private calificacionesClient;
    private alumnosClient;
    private asistenciasClient;
    private calificacionesService;
    private asistenciasService;
    constructor(calificacionesClient: ClientGrpc, alumnosClient: ClientGrpc, asistenciasClient: ClientGrpc);
    onModuleInit(): void;
    generateReportGrpc(nrc: string, formato: string): Promise<{
        file_bytes: Buffer;
        file_name: string;
    }>;
    generarExcelCalificaciones(nrc: string): Promise<ExcelJS.Workbook>;
}
