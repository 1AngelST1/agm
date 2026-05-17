/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import * as nodemailer from 'nodemailer';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth-grpc.guard';
import { Roles } from './decorators/roles.decorator';

interface AuthServiceClient {
  ValidateToken(data: { token: string }): any;
}

interface NotificacionRequest {
  usuario_id?: string;
  usuarioId?: string;
  matricula?: string;
  nombre_alumno?: string;
  nombreAlumno?: string;
  materia_id?: string;
  materiaId?: string;
  nombre_materia?: string;
  nombreMateria?: string;
  nombre_profesor?: string;
  nombreProfesor?: string;
  email_destino?: string;
  emailDestino?: string;
  nueva_nota?: number;
  nuevaNota?: number;
  materia?: string;
  calificacion_anterior?: number;
  calificacion_nueva?: number;
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
    this.authService =
      this.authClient.getService<AuthServiceClient>('AuthService');
  }

  // ==========================================
  // 🌐 ENDPOINTS REST
  // ==========================================

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

  @Post('baja')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'docente')
  async enviarBajaREST(
    @Body()
    body: {
      usuario_id: string;
      materia_id: string;
      email_destino: string;
    },
  ) {
    await this.enviarEmail(
      body.email_destino,
      'Alerta: Baja de Asignatura',
      `Se confirma la baja de la materia: <strong>${body.materia_id}</strong> para la matrícula <strong>${body.usuario_id}</strong>.`,
    );
    return { success: true, message: 'Baja notificada' };
  }

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

  // ==========================================
  // 📡 MÉTODOS GRPC
  // ==========================================

  @GrpcMethod('NotificacionesService')
  async sendBienvenida(data: NotificacionRequest) {
    console.log('📡 DATOS RECIBIDOS EN NOTIFICACIONES:', JSON.stringify(data, null, 2));
    
    // Intentar ambos formatos (snake_case y camelCase)
    const nombreAlumno = data.nombre_alumno || data.nombreAlumno || 'Estudiante';
    const materia = data.nombre_materia || data.nombreMateria || data.materia_id || data.materiaId || data.materia || 'Materia';
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';

    console.log('✅ VALORES PROCESADOS:', { nombreAlumno, materia, email });

    try {
      const subject = `¡Bienvenido ${nombreAlumno} a ${materia}!`;
      const body = `Hola ${nombreAlumno},<br><br>Te has inscrito exitosamente a la materia <strong>${materia}</strong>.<br><br>Esperamos que tengas un excelente desempeño en este curso.`;
      
      console.log('📧 ENVIANDO EMAIL:', { subject, to: email });
      
      await this.enviarEmail(email, subject, body);
      return { success: true, message: 'Correo enviado correctamente' };
    } catch (error) {
      console.error('❌ Error enviando email:', (error as Error).message);
      return { success: false, message: 'Fallo al enviar correo' };
    }
  }

  @GrpcMethod('NotificacionesService')
  async sendBajaNotif(data: NotificacionRequest) {
    const usuario = data.usuario_id || data.usuarioId || 'Sin Matrícula';
    const materia = data.materia_id || data.materiaId || 'Sin Materia';
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';

    try {
      await this.enviarEmail(
        email,
        'Alerta: Baja de Asignatura',
        `Se confirma la baja de la materia: <strong>${materia}</strong> para la matrícula <strong>${usuario}</strong>.`
      );
      return { success: true, message: 'Baja notificada' };
    } catch (_error) {
      return { success: false, message: 'Error' };
    }
  }

  @GrpcMethod('NotificacionesService')
  async sendActualizacion(data: NotificacionRequest) {
    const usuario = data.usuario_id || data.usuarioId || data.matricula || 'Sin Matrícula';
    const materia = data.nombre_materia || data.nombreMateria || data.materia_id || data.materiaId || data.materia || 'Sin Materia';
    const notaAnterior = data.calificacion_anterior || 0;
    const notaNueva = data.nueva_nota || data.nuevaNota || data.calificacion_nueva || 0;
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';

    try {
      const mensaje = notaAnterior > 0 
        ? `Tu nota en <strong>${materia}</strong> ha sido actualizada. <br> Nota anterior: <strong>${notaAnterior}</strong> <br> Nueva nota: <strong>${notaNueva}</strong>`
        : `Tu nota en <strong>${materia}</strong> ha sido registrada: <strong>${notaNueva}</strong>`;

      await this.enviarEmail(
        email,
        'Actualización de Calificación',
        mensaje
      );
      return { success: true, message: 'Actualización notificada' };
    } catch (_error) {
      return { success: false, message: 'Error' };
    }
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
      throw err;
    }
  }

  @Post('test/baja')
  testBaja(@Body() data: NotificacionRequest) {
    this.sendBajaNotif(data).catch(err => console.error(err));
    return { success: true, message: 'Test de baja enviado' };
  }

  @Post('test/actualizacion')
  testActualizacion(@Body() data: NotificacionRequest) {
    this.sendActualizacion(data).catch(err => console.error(err));
    return { success: true, message: 'Test de actualización enviado' };
  }

  @Post('test/bienvenida')
  testBienvenida(@Body() data: NotificacionRequest) {
    this.sendBienvenida(data).catch(err => console.error(err));
    return { success: true, message: 'Test de bienvenida enviado' };
  }
}