import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardAlumno } from './dashboard-alumno';

describe('DashboardAlumno', () => {
  let component: DashboardAlumno;
  let fixture: ComponentFixture<DashboardAlumno>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardAlumno]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardAlumno);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
