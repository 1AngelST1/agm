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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const path = __importStar(require("path"));
const getProtoPath = (protoFile) => {
    if (process.env.NODE_ENV === 'production') {
        return `/app/proto/${protoFile}`;
    }
    const proto = path.join(__dirname, `../../proto/${protoFile}`);
    console.log(`🔧 [ms-reportes] Cargando proto: ${proto}`);
    return proto;
};
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            microservices_1.ClientsModule.register([
                {
                    name: 'CALIFICACIONES_SERVICE',
                    transport: microservices_1.Transport.GRPC,
                    options: {
                        package: 'calificaciones',
                        protoPath: getProtoPath('calificaciones.proto'),
                        url: `${process.env.CALIFICACIONES_GRPC_HOST || 'localhost'}:${process.env.CALIFICACIONES_GRPC_PORT || 5003}`,
                    },
                },
                {
                    name: 'ALUMNOS_SERVICE',
                    transport: microservices_1.Transport.GRPC,
                    options: {
                        package: 'alumnos',
                        protoPath: getProtoPath('alumnos.proto'),
                        url: `${process.env.ALUMNOS_GRPC_HOST || 'localhost'}:${process.env.ALUMNOS_GRPC_PORT || 5002}`,
                    },
                },
                {
                    name: 'ASISTENCIAS_SERVICE',
                    transport: microservices_1.Transport.GRPC,
                    options: {
                        package: 'asistencias',
                        protoPath: getProtoPath('asistencias.proto'),
                        url: `${process.env.ASISTENCIAS_GRPC_HOST || 'localhost'}:${process.env.ASISTENCIAS_GRPC_PORT || 5004}`,
                    },
                },
            ]),
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map