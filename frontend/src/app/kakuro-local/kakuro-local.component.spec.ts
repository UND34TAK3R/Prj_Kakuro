import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KakuroLocalComponent } from './kakuro-local.component';

describe('KakuroLocalComponent', () => {
  let component: KakuroLocalComponent;
  let fixture: ComponentFixture<KakuroLocalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KakuroLocalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KakuroLocalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
