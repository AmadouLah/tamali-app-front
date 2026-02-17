import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessSectorsComponent } from './business-sectors.component';

describe('BusinessSectorsComponent', () => {
  let component: BusinessSectorsComponent;
  let fixture: ComponentFixture<BusinessSectorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessSectorsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusinessSectorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
