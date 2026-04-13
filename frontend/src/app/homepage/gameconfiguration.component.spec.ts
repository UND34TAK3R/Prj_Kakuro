import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameConfigurationComponent } from './gameconfiguraton.component';

describe('GameConfigurationComponent', () => {
  let component: GameConfigurationComponent;
  let fixture: ComponentFixture<GameConfigurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameConfigurationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
