import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth';
import { CalificacionesService } from '../../../core/services/calificaciones.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-profesor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-profesor.html',
  styleUrl: './dashboard-profesor.scss',
})
export class DashboardProfesor implements OnInit {
  private authService = inject(AuthService);
  private calificacionesService = inject(CalificacionesService);
  private router = inject(Router);

  // Signals - Grupos y Alumnos
  usuario = this.authService.usuarioActual;
  misGrupos = signal<any>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  // Modal para ver alumnos
  mostrarModalAlumnos = signal(false);
  alumnosDelGrupo = signal<any>(null);
  grupoSeleccionado = signal<any>(null);
  cargandoAlumnos = signal(false);

  // Modal para INSERTAR calificación
  mostrarModalInsertar = signal(false);
  formInsertar = signal({
    nrc_grupo: '',
    matricula_alumno: '',
    calificacion_ordinaria: 0
  });
  guardandoInsertar = signal(false);
  errorInsertar = signal<string | null>(null);

  // Modal para EDITAR calificación
  mostrarModalEditar = signal(false);
  calificacionEditando = signal<any>(null);
  formEditar = signal({
    calificacion_ordinaria: 0
  });
  guardandoEditar = signal(false);
  errorEditar = signal<string | null>(null);

  ngOnInit() {
    this.cargarMisGrupos();
  }

  cargarMisGrupos() {
    this.cargando.set(true);
    this.error.set(null);

    this.calificacionesService.obtenerMisGrupos().subscribe({
      next: (res: any) => {
        this.misGrupos.set(res);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar grupos:', err);
        this.error.set('Error al cargar tus grupos. Intenta más tarde.');
        this.cargando.set(false);
      }
    });
  }

  // 👥 Ver alumnos del grupo
  verAlumnos(grupo: any) {
    this.grupoSeleccionado.set(grupo);
    this.cargandoAlumnos.set(true);
    this.mostrarModalAlumnos.set(true);

    this.calificacionesService.obtenerAlumnosDelGrupo(grupo.nrc).subscribe({
      next: (res: any) => {
        this.alumnosDelGrupo.set(res);
        this.cargandoAlumnos.set(false);
      },
      error: (err) => {
        console.error('Error al cargar alumnos:', err);
        this.alumnosDelGrupo.set({
          alumnos: [],
          error: 'Error al cargar la lista de alumnos'
        });
        this.cargandoAlumnos.set(false);
      }
    });
  }

  cerrarModal() {
    this.mostrarModalAlumnos.set(false);
    this.alumnosDelGrupo.set(null);
    this.grupoSeleccionado.set(null);
  }

  // ═══════════════════════════════════════════════════════════════
  // INSERTAR CALIFICACIÓN (Modal)
  // ═══════════════════════════════════════════════════════════════

  abrirModalInsertar(grupo: any) {
    this.formInsertar.set({
      nrc_grupo: grupo.nrc,
      matricula_alumno: '',
      calificacion_ordinaria: 0
    });
    this.errorInsertar.set(null);
    this.mostrarModalInsertar.set(true);
  }

  cerrarModalInsertar() {
    this.mostrarModalInsertar.set(false);
    this.formInsertar.set({
      nrc_grupo: '',
      matricula_alumno: '',
      calificacion_ordinaria: 0
    });
    this.errorInsertar.set(null);
  }

  actualizarMatriculaInsertar(valor: string) {
    this.formInsertar.update(form => ({
      ...form,
      matricula_alumno: valor
    }));
  }

  actualizarCalificacionInsertar(valor: number) {
    this.formInsertar.update(form => ({
      ...form,
      calificacion_ordinaria: valor
    }));
  }

  guardarCalificacion() {
    const form = this.formInsertar();

    // Validación: Verificar que todos los campos estén completos
    if (!form.nrc_grupo || !form.nrc_grupo.trim()) {
      this.errorInsertar.set('Error: Falta el NRC del grupo');
      return;
    }

    if (!form.matricula_alumno || !form.matricula_alumno.trim()) {
      this.errorInsertar.set('Ingresa la matrícula del alumno');
      return;
    }

    if (form.calificacion_ordinaria < 0 || form.calificacion_ordinaria > 10) {
      this.errorInsertar.set('La calificación debe estar entre 0 y 10');
      return;
    }

    this.guardandoInsertar.set(true);
    this.errorInsertar.set(null);

    this.calificacionesService.crearCalificacion({
      nrc_grupo: form.nrc_grupo,
      matricula_alumno: form.matricula_alumno,
      calificacion_ordinaria: form.calificacion_ordinaria
    }).subscribe({
      next: (res: any) => {
        console.log('✅ Calificación creada:', res);
        this.guardandoInsertar.set(false);
        this.cerrarModalInsertar();
        
        // Recargar alumnos del grupo para reflejar la nueva calificación
        if (this.grupoSeleccionado()) {
          setTimeout(() => {
            this.verAlumnos(this.grupoSeleccionado());
          }, 300);
        }
      },
      error: (err) => {
        console.error('❌ Error al crear calificación:', err);
        const mensaje = err.error?.message || err.message || 'Error al guardar la calificación';
        this.errorInsertar.set(mensaje);
        this.guardandoInsertar.set(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // EDITAR CALIFICACIÓN (Modal)
  // ═══════════════════════════════════════════════════════════════

  abrirModalEditar(calificacion: any) {
    this.calificacionEditando.set(calificacion);
    this.formEditar.set({
      calificacion_ordinaria: calificacion.calificacion_ordinaria
    });
    this.errorEditar.set(null);
    this.mostrarModalEditar.set(true);
  }

  cerrarModalEditar() {
    this.mostrarModalEditar.set(false);
    this.calificacionEditando.set(null);
    this.formEditar.set({
      calificacion_ordinaria: 0
    });
    this.errorEditar.set(null);
  }

  actualizarCalificacionEditar(valor: number) {
    this.formEditar.update(form => ({
      ...form,
      calificacion_ordinaria: valor
    }));
  }

  actualizarCalificacion() {
    const calificacion = this.calificacionEditando();
    const form = this.formEditar();

    // Validación: Verificar que tenemos los datos necesarios
    if (!calificacion) {
      this.errorEditar.set('❌ Error: No se encontró la calificación a editar');
      return;
    }

    if (!calificacion.nrc_grupo) {
      console.error('❌ Error: nrc_grupo no disponible. Objeto:', calificacion);
      this.errorEditar.set('❌ Error crítico: No se encontró el NRC. Recarga la página.');
      return;
    }

    if (!calificacion.matricula_alumno) {
      console.error('❌ Error: matricula_alumno no disponible. Objeto:', calificacion);
      this.errorEditar.set('❌ Error crítico: No se encontró la matrícula del alumno. Recarga la página.');
      return;
    }

    // Validación: Calificación en rango válido
    if (form.calificacion_ordinaria < 0 || form.calificacion_ordinaria > 10) {
      this.errorEditar.set('⚠️ La calificación debe estar entre 0 y 10');
      return;
    }

    // Validación: Verificar que la calificación cambió
    if (form.calificacion_ordinaria === calificacion.calificacion_ordinaria) {
      this.errorEditar.set('ℹ️ La calificación no ha cambiado');
      return;
    }

    this.guardandoEditar.set(true);
    this.errorEditar.set(null);

    console.log('📤 Enviando PUT:', {
      url: `/calificaciones/${calificacion.nrc_grupo}/${calificacion.matricula_alumno}`,
      body: { calificacion_ordinaria: form.calificacion_ordinaria }
    });

    this.calificacionesService.actualizarCalificacion(
      calificacion.nrc_grupo, 
      calificacion.matricula_alumno, 
      {
        calificacion_ordinaria: form.calificacion_ordinaria
      }
    ).subscribe({
      next: (res: any) => {
        console.log('✅ Calificación actualizada exitosamente:', res);
        this.guardandoEditar.set(false);
        this.cerrarModalEditar();
        
        // Recargar alumnos del grupo para reflejar los cambios
        if (this.grupoSeleccionado()) {
          setTimeout(() => {
            this.verAlumnos(this.grupoSeleccionado());
          }, 300);
        }
      },
      error: (err) => {
        console.error('❌ Error al actualizar calificación:', err);
        const mensaje = err.error?.message || err.message || 'Error desconocido al actualizar';
        this.errorEditar.set('❌ ' + mensaje);
        this.guardandoEditar.set(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ELIMINAR CALIFICACIÓN
  // ═══════════════════════════════════════════════════════════════

  eliminarCalificacion(calificacion: any) {
    if (confirm(`¿Estás seguro de que deseas eliminar la calificación del alumno ${calificacion.matricula_alumno}?`)) {
      this.calificacionesService.eliminarCalificacion(
        calificacion.nrc_grupo,
        calificacion.matricula_alumno
      ).subscribe({
        next: (res: any) => {
          console.log('✅ Calificación eliminada:', res);
          
          // Recargar alumnos del grupo para reflejar la eliminación
          if (this.grupoSeleccionado()) {
            this.verAlumnos(this.grupoSeleccionado());
          }
        },
        error: (err) => {
          console.error('❌ Error al eliminar calificación:', err);
          alert('Error al eliminar la calificación');
        }
      });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
