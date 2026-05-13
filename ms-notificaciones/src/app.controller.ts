import { Controller, Post, Body, UseGuards, Inject, OnModuleInit } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import * as nodemailer from 'nodemailer';
import { Observable, of, firstValueFrom } from 'rxjs';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth-grpc.guard';
import { Roles } from './decorators/roles.decorator';

interface AuthServiceClient {
  ValidateToken(data: { token: string }): any;
}

interface NotificacionPayload {
  usuario_id?: string;
  usuarioId?: string;
  materia_id?: string;
  materiaId?: string;
  email_destino?: string;
  emailDestino?: string;
  nueva_nota?: number;
  nuevaNota?: number;
}

@Controller('notificaciones')
export class AppController implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private authService!: AuthServiceClient;

  constructor(@Inject('AUTH_SERVICE') private authClient: ClientGrpc) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'angel.bdtos0312@gmail.com',
        pass: 'lbpuhqibakioivcu',
      },
    });
  }

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceClient>('AuthService');
  }

  /**
   * ✅ POST /notificaciones/bienvenida
   * Enviar correo de bienvenida (admin, docente)
   */
  @Post('bienvenida')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async enviarBienvenidaREST(
    @Body() body: { usuario_id: string; email_destino: string },
  ) {
    await this.enviarEmail(
      body.email_destino,
      '¡Bienvenido al Sistema AGM BUAP!',
      `Tu cuenta ha sido creada con la matrícula: <strong>${body.usuario_id}</strong>.`,
    );
    return { success: true, message: 'Bienvenida enviada' };
  }

  /**
   * ✅ POST /notificaciones/baja
   * Enviar notificación de baja (admin, docente)
   */
  @Post('baja')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async enviarBajaREST(
    @Body() body: { usuario_id: string; materia_id: string; email_destino: string },
  ) {
    await this.enviarEmail(
      body.email_destino,
      'Alerta: Baja de Asignatura',
      `Se confirma la baja de la materia: <strong>${body.materia_id}</strong> para la matrícula <strong>${body.usuario_id}</strong>.`,
    );
    return { success: true, message: 'Baja notificada' };
  }

  /**
   * ✅ POST /notificaciones/cierre-materia
   * Enviar notificación de cierre de materia (admin, docente)
   */
  @Post('cierre-materia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async enviarCierreMateriaREST(
    @Body() body: { materia_id: string; email_destino: string },
  ) {
    await this.enviarEmail(
      body.email_destino,
      'Cierre de Materia - Calificaciones Publicadas',
      `La materia <strong>${body.materia_id}</strong> ha sido cerrada y las calificaciones han sido publicadas.`,
    );
    return { success: true, message: 'Cierre notificado' };
  }

  @GrpcMethod('NotificacionesService', 'SendBienvenida')
  grpcSendBienvenida(data: NotificacionPayload): Observable<any> {
    const usuario = data.usuario_id || data.usuarioId || 'Sin Matrícula';
    const email =
      data.email_destino ||
      data.emailDestino ||
      'angel.sarmientot@alumno.buap.mx';

    this.enviarEmail(
      email,
      '¡Bienvenido al Sistema AGM BUAP!',
      `Tu cuenta ha sido creada con la matrícula: <strong>${usuario}</strong>.`,
    ).catch((err: Error) => console.error('❌ Error gRPC Bienvenida:', err));

    return of({ success: true, message: 'Bienvenida procesada' });
  }

  @GrpcMethod('NotificacionesService', 'SendBajaNotif')
  grpcSendBaja(data: NotificacionPayload): Observable<any> {
    const usuario = data.usuario_id || data.usuarioId || 'Sin Matrícula';
    const materia = data.materia_id || data.materiaId || 'Sin Materia';
    const email =
      data.email_destino ||
      data.emailDestino ||
      'angel.sarmientot@alumno.buap.mx';

    console.log(`📦 Recibido -> Usuario: ${usuario}, Materia: ${materia}`);

    this.enviarEmail(
      email,
      'Alerta: Baja de Asignatura',
      `Se confirma la baja de la materia: <strong>${materia}</strong> para la matrícula <strong>${usuario}</strong>.`,
    ).catch((err: Error) => console.error('❌ Error gRPC Baja:', err));

    return of({ success: true, message: 'Baja procesada' });
  }

  @GrpcMethod('NotificacionesService', 'SendActualizacion')
  grpcSendActualizacion(data: NotificacionPayload): Observable<any> {
    const usuario = data.usuario_id || data.usuarioId || 'Sin Matrícula';
    const materia = data.materia_id || data.materiaId || 'Sin Materia';
    const nota = data.nueva_nota || data.nuevaNota || 0;
    const email =
      data.email_destino ||
      data.emailDestino ||
      'angel.sarmientot@alumno.buap.mx';

    this.enviarEmail(
      email,
      'Actualización de Calificación',
      `Tu nota en <strong>${materia}</strong> ha sido actualizada (Matrícula: ${usuario}). <br> Nueva nota: <strong>${nota}</strong>`,
    ).catch((err: Error) => console.error('❌ Error gRPC Actualización:', err));

    return of({ success: true, message: 'Actualización procesada' });
  }

  private async enviarEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: '"Sistema AGM BUAP" <angel.bdtos0312@gmail.com>',
        to,
        subject,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #003b5c;">${subject}</h2>
            <p style="font-size: 16px; color: #333;">${htmlContent}</p>
            <hr style="border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              Saludos, <br> 
              <strong>Administración Académica BUAP</strong>
            </p>
          </div>`,
      });
      console.log(`✅ Correo enviado a: ${to}`);
    } catch (err) {
      console.error('❌ Error SMTP:', err);
    }
  }

  @Post('test/baja')
  testBaja(@Body() data: NotificacionPayload) {
    this.grpcSendBaja(data);
    return { success: true, message: 'Test de baja enviado' };
  }

  @Post('test/actualizacion')
  testActualizacion(@Body() data: NotificacionPayload) {
    this.grpcSendActualizacion(data);
    return { success: true, message: 'Test de actualización enviado' };
  }

  @Post('test/bienvenida')
  testBienvenida(@Body() data: NotificacionPayload) {
    this.grpcSendBienvenida(data);
    return { success: true, message: 'Test de bienvenida enviado' };
  }
}
