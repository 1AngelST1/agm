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
  calificacionNueva?: number;
  calificacion_nueva?: number;
  materia?: string;
  calificacion_anterior?: number;
  calificacionAnterior?: number;
  tipo_calificacion?: string;
  tipoCalificacion?: string;
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
    
    const nombreAlumno = data.nombre_alumno || data.nombreAlumno || 'Estudiante';
    const materia = data.nombre_materia || data.nombreMateria || data.materia_id || data.materiaId || data.materia || 'Materia';
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';

    console.log('✅ VALORES PROCESADOS:', { nombreAlumno, materia, email });

    try {
      const subject = `¡Bienvenido ${nombreAlumno} a ${materia}!`;
      const body = `Hola ${nombreAlumno},<br><br>Haz sido inscrito exitosamente a la materia <strong>${materia}</strong>.<br><br>Esperamos que tengas un excelente desempeño en este curso.`;
      
      console.log('📧 ENVIANDO EMAIL:', { subject, to: email });
      
      await this.enviarEmail(email, subject, body);
      return { success: true, message: 'Correo enviado correctamente' };
    } catch (error) {
      console.error('❌ Error enviando email:', (error as Error).message);
      return { success: false, message: 'Fallo al enviar correo' };
    }
  }

  @GrpcMethod('NotificacionesService', 'SendCuentaCreada')
  async sendCuentaCreada(data: { nombre_usuario?: string; nombreUsuario?: string; email_destino?: string; emailDestino?: string; rol?: string }) {
    console.log('📩 [NOTIFICACIONES] Petición de nueva cuenta recibida:', JSON.stringify(data, null, 2));
    
    // Extraemos los datos atrapando tanto camelCase como snake_case por si acaso
    const nombreUsuario = data.nombre_usuario || data.nombreUsuario || 'Usuario';
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';
    const rol = data.rol || 'N/A';

    try {
      const subject = `Tu cuenta ha sido creada - Sistema AGM BUAP`;
      
      // 🎨 PLANTILLA HTML PROFESIONAL (Modo Oscuro) en la variable body
      const body = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; padding: 40px 20px; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e1e1e; border-radius: 10px; overflow: hidden; border: 1px solid #333333; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <div style="padding: 30px; border-bottom: 1px solid #333333;">
            <h2 style="color: #66b3ff; margin: 0; font-size: 24px;">¡Bienvenido al Sistema AGM BUAP!</h2>
          </div>

          <!-- Body -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #e0e0e0; line-height: 1.6;">
              Hola <strong>${nombreUsuario}</strong>,
            </p>
            <p style="font-size: 16px; color: #e0e0e0; line-height: 1.6;">
              Nos complace informarte que tu cuenta ha sido habilitada exitosamente en nuestra plataforma institucional.
            </p>
            <p style="font-size: 16px; color: #e0e0e0; line-height: 1.6;">
              Se te ha asignado el rol de: <span style="color: #66b3ff; font-weight: bold; text-transform: uppercase;">${rol}</span>
            </p>
            <p style="font-size: 16px; color: #e0e0e0; line-height: 1.6;">
              A partir de este momento, ya puedes iniciar sesión y acceder a los módulos correspondientes a tu perfil. Esperamos que tengas una excelente experiencia.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #444444; margin: 40px 0 20px 0;" />
            
            <p style="font-size: 14px; color: #aaaaaa; margin: 0;">Saludos,</p>
            <p style="font-size: 14px; font-weight: bold; color: #e0e0e0; margin: 5px 0 0 0;">Administración Académica BUAP</p>
          </div>

          <!-- Footer Confidencialidad -->
          <div style="background-color: #141414; padding: 20px 30px; text-align: justify;">
            <p style="font-size: 10px; color: #666666; line-height: 1.4; margin: 0;">
              La información contenida en este correo se dirige exclusivamente a su destinatario; puede contener INFORMACIÓN CONFIDENCIAL cuya divulgación está prohibida por la ley. Si recibió este mensaje por error, evite su utilización, reproducción o difusión, debiendo eliminarlo de su computadora o cualquier dispositivo electrónico y comunicarlo inmediatamente por esta vía a su emisor.
            </p>
            <p style="font-size: 10px; color: #666666; line-height: 1.4; margin: 10px 0 0 0;">
              Puede consultar los avisos de privacidad para el tratamiento de datos personales en <a href="https://transparencia.buap.mx" style="color: #66b3ff; text-decoration: none;">https://transparencia.buap.mx</a>.
            </p>
          </div>
        </div>
      </div>
      `;
      
      console.log('📧 ENVIANDO EMAIL DE CUENTA:', { subject, to: email });
      
      // 🔥 Usamos tu método existente que hace el envío real
      await this.enviarEmail(email, subject, body);
      
      return { success: true, message: 'Correo de cuenta creada enviado exitosamente' };
    } catch (error) {
      console.error('❌ Error enviando email de nueva cuenta:', (error as Error).message);
      return { success: false, message: 'Fallo al enviar correo de cuenta' };
    }
  }

  @GrpcMethod('NotificacionesService')
  async sendBajaNotif(data: NotificacionRequest) {
    console.log('📡 DATOS RECIBIDOS (Baja):', JSON.stringify(data, null, 2));
    
    const nombreAlumno = data.nombre_alumno || data.nombreAlumno || 'Estudiante';
    const materia = data.nombre_materia || data.nombreMateria || data.materia_id || data.materiaId || 'Materia';
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';

    console.log('✅ VALORES PROCESADOS (Baja):', { nombreAlumno, materia, email });

    try {
      const subject = `Notificación de Baja Oficial: ${materia}`;
      
      // 🔥 TEXTO CORREGIDO: Más directo, como baja definitiva
      const body = `Hola ${nombreAlumno},<br><br>Te informamos que se ha procesado correctamente tu baja definitiva de la materia <strong>${materia}</strong>.<br><br>Si esto fue un error o tienes alguna duda, contacta inmediatamente con la administración académica.`;
      
      console.log('📧 ENVIANDO EMAIL (Baja):', { subject, to: email });
      
      await this.enviarEmail(email, subject, body);
      return { success: true, message: 'Correo de baja enviado correctamente' };
    } catch (error) {
      console.error('❌ Error enviando email de baja:', (error as Error).message);
      return { success: false, message: 'Fallo al enviar correo' };
    }
  }

  @GrpcMethod('NotificacionesService')
  async sendActualizacion(data: NotificacionRequest) {
    console.log('📡 DATOS RECIBIDOS (Actualización):', JSON.stringify(data, null, 2));
    
    const nombreAlumno = data.nombre_alumno || data.nombreAlumno || 'Estudiante';
    const materia = data.nombre_materia || data.nombreMateria || data.materia_id || data.materiaId || data.materia || 'Materia';
    
    const notaAnterior = data.calificacionAnterior ?? data.calificacion_anterior ?? 0;
    const notaNueva = data.calificacionNueva ?? data.calificacion_nueva ?? data.nuevaNota ?? data.nueva_nota ?? 0;
    
    const email = data.email_destino || data.emailDestino || 'angel.sarmientot@alumno.buap.mx';
    const tipoCalificacion = data.tipo_calificacion || data.tipoCalificacion || 'ordinaria';

    console.log('✅ VALORES PROCESADOS (Actualización):', { nombreAlumno, materia, tipoCalificacion, notaAnterior, notaNueva, email });

    try {
      const mensaje = notaAnterior > 0 
        ? `Tu nota de <strong>${tipoCalificacion.toUpperCase()}</strong> en <strong>${materia}</strong> ha sido actualizada. <br> Nota anterior: <strong>${notaAnterior}</strong> <br> Nueva nota: <strong>${notaNueva}</strong>`
        : `Tu calificación de <strong>${tipoCalificacion.toUpperCase()}</strong> en <strong>${materia}</strong> ha sido registrada: <strong>${notaNueva}</strong>`;

      const subject = `Actualización de Calificación en ${materia} (${tipoCalificacion.toUpperCase()})`;
      
      console.log('📧 ENVIANDO EMAIL (Actualización):', { subject, to: email });

      await this.enviarEmail(
        email,
        subject,
        `Hola ${nombreAlumno},<br><br>${mensaje}<br><br>Esperamos continúes con tu desempeño.`
      );
      return { success: true, message: 'Actualización notificada correctamente' };
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

  // ==========================================
  // 🔐 RESET DE CONTRASEÑA
  // ==========================================

  @GrpcMethod('NotificacionesService')
  async sendResetPassword(data: { email_destino: string; reset_link: string; nombre_usuario?: string }) {
    console.log('📡 DATOS RECIBIDOS (Reset Password):', JSON.stringify(data, null, 2));
    
    const email = data.email_destino || 'sin-email@buap.mx';
    const nombreUsuario = data.nombre_usuario || 'Usuario';
    const resetLink = data.reset_link || 'https://agm-buap.mx/reset';

    console.log('✅ VALORES PROCESADOS (Reset):', { email, nombreUsuario, resetLink });

    try {
      const subject = 'Recuperación de Contraseña - Sistema AGM BUAP';
      const body = `Hola ${nombreUsuario},<br><br>Has solicitado recuperar tu contraseña. Haz clic en el siguiente enlace para establecer una nueva contraseña:<br><br><a href="${resetLink}" style="background-color: #003b5c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Recuperar Contraseña</a><br><br>Este enlace expira en 1 hora.<br><br>Si no solicitaste este cambio, ignora este correo.`;
      
      console.log('📧 ENVIANDO EMAIL (Reset):', { subject, to: email });
      
      await this.enviarEmail(email, subject, body);
      return { success: true, message: 'Correo de recuperación enviado correctamente' };
    } catch (error) {
      console.error('❌ Error enviando email de reset:', (error as Error).message);
      return { success: false, message: 'Fallo al enviar correo' };
    }
  }

  @Post('test/reset-password')
  testResetPassword(@Body() data: { email_destino: string; reset_link: string; nombre_usuario?: string }) {
    this.sendResetPassword(data).catch(err => console.error(err));
    return { success: true, message: 'Test de reset enviado' };
  }
}