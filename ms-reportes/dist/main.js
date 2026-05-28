"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const path_1 = require("path");
async function bootstrap() {
    const logger = new common_1.Logger('MS-REPORTES');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.connectMicroservice({
        transport: microservices_1.Transport.GRPC,
        options: {
            package: 'reportes',
            protoPath: (0, path_1.join)(__dirname, '../../proto/reportes.proto'),
            url: '0.0.0.0:5007',
        },
    });
    await app.startAllMicroservices();
    logger.log('📡 Servidor gRPC escuchando en el puerto 5007');
    const restPort = 3007;
    await app.listen(restPort);
    logger.log(`🚀 Servidor REST escuchando en http://localhost:${restPort}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map