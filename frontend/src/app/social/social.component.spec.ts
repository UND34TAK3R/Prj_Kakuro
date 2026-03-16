import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SocialHubComponent } from './social.component';

describe('SocialComponent', () => {
  let component: SocialHubComponent;
  let fixture: ComponentFixture<SocialHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialHubComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SocialHubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
