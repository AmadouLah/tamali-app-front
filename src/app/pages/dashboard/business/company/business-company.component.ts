import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { forkJoin, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { BusinessSectorStoreService } from '../../../../core/services/business-sector-store.service';
import {
  BusinessDto,
  BusinessSectorDto,
  ReceiptTemplateDto,
  LEGAL_STATUS_OPTIONS
} from '../../../../core/models/business.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-business-company',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-company.component.html',
  styleUrl: './business-company.component.css'
})
export class BusinessCompanyComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly sectorStore = inject(BusinessSectorStoreService);
  private sectorStoreSub?: Subscription;

  user = this.authService.getUser();
  business: BusinessDto | null = null;
  sectors: BusinessSectorDto[] = [];
  templates: ReceiptTemplateDto[] = [];
  form!: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'mon entreprise';
  sidebarOpen = false;
  logoFile: File | null = null;
  logoPreview: string | null = null;

  readonly legalStatuses = LEGAL_STATUS_OPTIONS;
  readonly menuItems = BUSINESS_OWNER_MENU_ITEMS;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      if (this.user && this.authService.shouldRedirectToSetup(this.user)) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    if (!this.user || !this.user.businessId) {
      if (this.user) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    this.buildForm();
    this.sectorStoreSub = this.sectorStore.sectors$.subscribe(() => {
      // Mettre à jour la liste des secteurs actifs quand le store change
      const allSectors = this.sectorStore.sectors;
      this.sectors = allSectors.filter(s => s.active);
      this.sectorsVersion++;
    });
    this.loadSectors();
    this.loadTemplates();
    this.loadBusiness();
  }

  ngOnDestroy(): void {
    this.sectorStoreSub?.unsubscribe();
  }

  /** Incrémenté à chaque mise à jour du store pour forcer le recalcul des getters. */
  sectorsVersion = 0;

  private buildForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      sectorId: ['', Validators.required],
      address: ['', Validators.required],
      phone: ['', Validators.required],
      country: ['', Validators.required],
      commerceRegisterNumber: [''],
      identificationNumber: [''],
      legalStatus: ['', Validators.required],
      bankAccountNumber: [''],
      websiteUrl: [''],
      receiptTemplateId: ['']
    });
  }

  private loadBusiness(): void {
    if (!this.user?.businessId) return;
    this.http.get<BusinessDto>(`${this.apiConfig.getBusinessesUrl()}/${this.user.businessId}`).subscribe({
      next: (b) => {
        this.business = b;
        this.form.patchValue({
          name: b.name ?? '',
          sectorId: b.sectorId ?? '',
          address: b.address ?? '',
          phone: b.phone ?? '',
          country: b.country ?? '',
          commerceRegisterNumber: b.commerceRegisterNumber ?? '',
          identificationNumber: b.identificationNumber ?? '',
          legalStatus: b.legalStatus ?? '',
          bankAccountNumber: b.bankAccountNumber ?? '',
          websiteUrl: b.websiteUrl ?? '',
          receiptTemplateId: b.receiptTemplateId ?? ''
        });
        if (b.logoUrl) this.logoPreview = b.logoUrl;
      },
      error: () => {}
    });
  }

  private loadSectors(): void {
    // Charger tous les secteurs dans le store pour avoir les mises à jour en temps réel
    this.http.get<BusinessSectorDto[]>(this.apiConfig.getBusinessSectorsUrl()).subscribe({
      next: (allSectors) => {
        this.sectorStore.setSectors(allSectors);
        // Filtrer pour n'afficher que les secteurs actifs dans le select
        this.sectors = allSectors.filter(s => s.active);
      },
      error: () => {
        // Fallback : charger uniquement les actifs si l'endpoint complet échoue
        this.http.get<BusinessSectorDto[]>(`${this.apiConfig.getBusinessSectorsUrl()}/active`).subscribe({
          next: (activeSectors) => {
            this.sectors = activeSectors;
            this.sectorStore.setSectors(activeSectors);
          },
          error: () => {}
        });
      }
    });
  }

  private loadTemplates(): void {
    this.http.get<ReceiptTemplateDto[]>(this.apiConfig.getReceiptTemplatesUrl()).subscribe({
      next: (data) => (this.templates = data),
      error: () => {}
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.logoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => (this.logoPreview = (e.target?.result as string) ?? null);
      reader.readAsDataURL(this.logoFile);
    }
  }

  save(): void {
    if (this.form.invalid || !this.user?.businessId) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;
    this.success = null;

    const v = this.form.value;
    const base = `${this.apiConfig.getBusinessesUrl()}/${this.user.businessId}/step`;

    const patch1 = this.http.patch(base, { step: 1, name: v.name, sectorId: v.sectorId || null });
    const patch2 = this.http.patch(base, { step: 2, address: v.address, phone: v.phone, country: v.country });
    const patch3 = this.http.patch(base, {
      step: 3,
      commerceRegisterNumber: v.commerceRegisterNumber || null,
      identificationNumber: v.identificationNumber || null
    });
    const patch4 = this.http.patch(base, {
      step: 4,
      legalStatus: v.legalStatus,
      bankAccountNumber: v.bankAccountNumber || null,
      websiteUrl: v.websiteUrl || null
    });

    forkJoin([patch1, patch2, patch3, patch4])
      .pipe(
        switchMap(() => {
          if (!this.logoFile || !this.user?.businessId) return of(null);
          const fd = new FormData();
          fd.append('file', this.logoFile);
          return this.http
            .post<BusinessDto>(`${this.apiConfig.getBusinessesUrl()}/${this.user.businessId}/logo`, fd)
            .pipe(catchError(() => of(null)));
        }),
        switchMap((logoRes) => {
          if (logoRes?.logoUrl) this.logoPreview = logoRes.logoUrl;
          if (!v.receiptTemplateId || !this.user?.businessId) return of(null);
          return this.http
            .patch(`${this.apiConfig.getBusinessesUrl()}/${this.user.businessId}/receipt-template`, {
              receiptTemplateId: v.receiptTemplateId
            })
            .pipe(catchError(() => of(null)));
        })
      )
      .subscribe({
        next: () => {
          this.business = { ...this.business, ...this.form.value };
          this.success = 'Entreprise mise à jour.';
          this.loading = false;
          this.logoFile = null;
        },
        error: (err) => {
          this.error = err.error?.message ?? 'Erreur lors de la mise à jour.';
          this.loading = false;
        }
      });
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  isFieldInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!(c && c.invalid && c.touched);
  }

  getFieldError(name: string): string {
    const c = this.form.get(name);
    if (!c?.errors || !c.touched) return '';
    if (c.errors['required']) return 'Requis';
    if (c.errors['minlength']) return `Min. ${c.errors['minlength'].requiredLength} caractères`;
    return '';
  }
}
