import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardProfesor } from './dashboard-profesor';

describe('DashboardProfesor', () => {
  let component: DashboardProfesor;
  let fixture: ComponentFixture<DashboardProfesor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardProfesor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardProfesor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
