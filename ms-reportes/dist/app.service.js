"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const ExcelJS = __importStar(require("exceljs"));
let AppService = class AppService {
    calificacionesClient;
    alumnosClient;
    asistenciasClient;
    calificacionesService;
    asistenciasService;
    constructor(calificacionesClient, alumnosClient, asistenciasClient) {
        this.calificacionesClient = calificacionesClient;
        this.alumnosClient = alumnosClient;
        this.asistenciasClient = asistenciasClient;
    }
    onModuleInit() {
        this.calificacionesService =
            this.calificacionesClient.getService('CalificacionesService');
        this.asistenciasService =
            this.asistenciasClient.getService('AsistenciasService');
    }
    async generateReportGrpc(nrc, formato) {
        console.log(`📊 [gRPC] Generando reporte de ${formato} para NRC: ${nrc}`);
        try {
            const workbook = await this.generarExcelCalificaciones(nrc);
            const bufferData = await workbook.xlsx.writeBuffer();
            const buffer = Buffer.from(bufferData);
            const fileName = `Acta_Calificaciones_${nrc}_${Date.now()}.${formato === 'xls' ? 'xlsx' : formato}`;
            console.log(`✅ [gRPC] Reporte generado: ${fileName} (${buffer.byteLength} bytes)`);
            return {
                file_bytes: buffer,
                file_name: fileName,
            };
        }
        catch (error) {
            console.error('❌ [gRPC] Error generando reporte:', error.message);
            throw new common_1.HttpException('Error generando reporte', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async generarExcelCalificaciones(nrc) {
        try {
            console.log(`📊 Solicitando datos a Calificaciones para NRC: ${nrc}...`);
            const concentradoData = await (0, rxjs_1.lastValueFrom)(this.calificacionesService.getConcentrado({ nrc }));
            if (!concentradoData || !concentradoData.calificaciones) {
                throw new Error('No se encontraron datos para este grupo');
            }
            console.log('✅ Datos recibidos, dibujando Excel...');
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sistema AGM BUAP';
            const worksheet = workbook.addWorksheet(`Acta - ${nrc}`);
            const pond = concentradoData.ponderaciones;
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
            const alumnos = concentradoData.calificaciones;
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
        }
        catch (error) {
            console.error('❌ Error generando Excel:', error.message);
            throw new common_1.HttpException('Error generando reporte', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('CALIFICACIONES_SERVICE')),
    __param(1, (0, common_1.Inject)('ALUMNOS_SERVICE')),
    __param(2, (0, common_1.Inject)('ASISTENCIAS_SERVICE')),
    __metadata("design:paramtypes", [Object, Object, Object])
], AppService);
//# sourceMappingURL=app.service.js.map