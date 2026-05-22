import { AppService } from './app.service';
import type { Response } from 'express';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    descargarReporteCalificaciones(nrc: string, res: Response): Promise<void>;
}
