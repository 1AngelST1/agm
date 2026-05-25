"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const app_service_1 = require("./app.service");
let AppController = class AppController {
    appService;
    constructor(appService) {
        this.appService = appService;
    }
    onModuleInit() {
        console.log('✅ [MS-Reportes] Controlador gRPC inicializado');
    }
    async generateReport(data) {
        console.log(`📡 [gRPC] GenerateReport - NRC: ${data.materia_id}, Formato: ${data.formato}`);
        try {
            if (!data.materia_id || !data.formato) {
                throw new common_1.HttpException('Parámetros requeridos: materia_id y formato', common_1.HttpStatus.BAD_REQUEST);
            }
            const validFormatos = ['pdf', 'xls'];
            if (!validFormatos.includes(data.formato)) {
                throw new common_1.HttpException(`Formato no soportado: ${data.formato}. Soportados: ${validFormatos.join(', ')}`, common_1.HttpStatus.BAD_REQUEST);
            }
            const result = await this.appService.generateReportGrpc(data.materia_id, data.formato);
            return {
                file_bytes: result.file_bytes,
                file_name: result.file_name,
            };
        }
        catch (error) {
            console.error('❌ [gRPC] Error en GenerateReport:', error.message);
            throw new common_1.HttpException(`Error generando reporte: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async descargarReporteCalificaciones(nrc, res) {
        try {
            const workbook = await this.appService.generarExcelCalificaciones(nrc);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Acta_Calificaciones_${nrc}.xlsx`);
            await workbook.xlsx.write(res);
            res.status(200).end();
        }
        catch (error) {
            console.error('Error al generar archivo:', error);
            res
                .status(500)
                .json({ success: false, message: 'No se pudo generar el reporte' });
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, microservices_1.GrpcMethod)('ReportesService', 'GenerateReport'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "generateReport", null);
__decorate([
    (0, common_1.Get)('calificaciones/:nrc'),
    __param(0, (0, common_1.Param)('nrc')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "descargarReporteCalificaciones", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)('reportes'),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map