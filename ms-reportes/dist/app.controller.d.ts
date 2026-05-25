import { OnModuleInit } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';
export declare class AppController implements OnModuleInit {
    private readonly appService;
    constructor(appService: AppService);
    onModuleInit(): void;
    generateReport(data: {
        materia_id: string;
        formato: string;
    }): Promise<{
        file_bytes: Buffer<ArrayBufferLike>;
        file_name: string;
    }>;
    descargarReporteCalificaciones(nrc: string, res: Response): Promise<void>;
}
