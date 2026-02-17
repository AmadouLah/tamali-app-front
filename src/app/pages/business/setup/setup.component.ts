import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';

interface BusinessSectorDto {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

interface ReceiptTemplateDto {
  id: string;
  code: string;
  name: string;
  htmlContent: string;
  cssContent?: string;
  isDefault: boolean;
  active: boolean;
}

interface BusinessDto {
  id: string;
  name?: string;
  sectorId?: string;
  address?: string;
  phone?: string;
  country?: string;
  commerceRegisterNumber?: string;
  identificationNumber?: string;
  legalStatus?: string;
  bankAccountNumber?: string;
  websiteUrl?: string;
  logoUrl?: string;
  receiptTemplateId?: string;
}

type LegalStatus = 'SARL' | 'SA' | 'SAS' | 'EURL' | 'SN' | 'SCS' | 'SCA' | 'EI' | 'AUTO_ENTREPRENEUR' | 'ASSOCIATION' | 'AUTRE';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.css'
})
export class SetupComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly apiConfig = inject(ApiConfigService);

  currentStep = 1;
  totalSteps = 6;
  userId: string | null = null;
  businessId: string | null = null;
  loading = false;
  error: string | null = null;

  sectors: BusinessSectorDto[] = [];
  templates: ReceiptTemplateDto[] = [];
  selectedTemplate: ReceiptTemplateDto | null = null;
  previewHtml: SafeHtml | null = null;
  logoFile: File | null = null;
  logoPreview: string | null = null;

  legalStatuses: { value: LegalStatus; label: string }[] = [
    { value: 'SARL', label: 'SARL - Société à Responsabilité Limitée' },
    { value: 'SA', label: 'SA - Société Anonyme' },
    { value: 'SAS', label: 'SAS - Société par Actions Simplifiée' },
    { value: 'EURL', label: 'EURL - Entreprise Unipersonnelle à Responsabilité Limitée' },
    { value: 'SN', label: 'SN - Société en Nom Collectif' },
    { value: 'SCS', label: 'SCS - Société en Commandite Simple' },
    { value: 'SCA', label: 'SCA - Société en Commandite par Actions' },
    { value: 'EI', label: 'EI - Entreprise Individuelle' },
    { value: 'AUTO_ENTREPRENEUR', label: 'Auto-entrepreneur' },
    { value: 'ASSOCIATION', label: 'Association' },
    { value: 'AUTRE', label: 'Autre' }
  ];

  step1Form!: FormGroup;
  step2Form!: FormGroup;
  step3Form!: FormGroup;
  step4Form!: FormGroup;

  ngOnInit(): void {
    this.initForms();
    this.route.queryParams.subscribe(params => {
      this.userId = params['userId'] || this.authService.getUser()?.id || null;
      if (!this.userId) {
        this.error = 'Identifiant utilisateur manquant.';
        return;
      }
      this.loadUserBusiness();
      this.loadSectors();
      this.loadTemplates();
    });
  }

  private initForms(): void {
    this.step1Form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      sectorId: ['', [Validators.required]]
    });

    this.step2Form = this.fb.group({
      address: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      country: ['', [Validators.required]]
    });

    this.step3Form = this.fb.group({
      commerceRegisterNumber: [''],
      identificationNumber: ['']
    });

    this.step4Form = this.fb.group({
      legalStatus: ['', [Validators.required]],
      bankAccountNumber: [''],
      websiteUrl: ['']
    });
  }

  private loadUserBusiness(): void {
    if (!this.userId) return;
    this.http.get<any>(`${this.apiConfig.getUsersUrl()}/${this.userId}`).subscribe({
      next: (user) => {
        if (user.businessId) {
          this.businessId = user.businessId;
          this.loadBusiness();
        }
      },
      error: () => {
        // L'utilisateur n'a pas encore d'entreprise, c'est normal
      }
    });
  }

  private loadBusiness(): void {
    if (!this.businessId) return;
    this.http.get<BusinessDto>(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}`).subscribe({
      next: (business) => {
        // Pré-remplir les formulaires avec les données existantes
        if (business.name) {
          this.step1Form.patchValue({ name: business.name, sectorId: business.sectorId });
        }
        if (business.address || business.phone || business.country) {
          this.step2Form.patchValue({
            address: business.address,
            phone: business.phone,
            country: business.country
          });
        }
        if (business.commerceRegisterNumber || business.identificationNumber) {
          this.step3Form.patchValue({
            commerceRegisterNumber: business.commerceRegisterNumber,
            identificationNumber: business.identificationNumber
          });
        }
        if (business.legalStatus || business.bankAccountNumber || business.websiteUrl) {
          this.step4Form.patchValue({
            legalStatus: business.legalStatus,
            bankAccountNumber: business.bankAccountNumber,
            websiteUrl: business.websiteUrl
          });
        }
        if (business.logoUrl) {
          this.logoPreview = business.logoUrl;
        }
        if (business.receiptTemplateId) {
          const template = this.templates.find(t => t.id === business.receiptTemplateId);
          if (template) {
            this.selectedTemplate = template;
            this.updatePreview();
          }
        }
      },
      error: () => {}
    });
  }

  private loadSectors(): void {
    this.http.get<BusinessSectorDto[]>(`${this.apiConfig.getBusinessSectorsUrl()}/active`).subscribe({
      next: (data) => {
        this.sectors = data;
      },
      error: () => {}
    });
  }

  private loadTemplates(): void {
    this.http.get<ReceiptTemplateDto[]>(this.apiConfig.getReceiptTemplatesUrl()).subscribe({
      next: (data) => {
        this.templates = data;
        // Sélectionner le template par défaut si disponible
        const defaultTemplate = data.find(t => t.isDefault);
        if (defaultTemplate) {
          this.selectedTemplate = defaultTemplate;
          this.updatePreview();
        }
      },
      error: () => {}
    });
  }

  async onStep1Submit(): Promise<void> {
    if (this.step1Form.invalid) {
      this.markFormGroupTouched(this.step1Form);
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      if (!this.businessId) {
        // Créer l'entreprise et la lier à l'utilisateur
        const createResponse = await this.http.post<BusinessDto>(this.apiConfig.getBusinessesUrl(), {
          name: this.step1Form.value.name,
          email: this.authService.getUser()?.email
        }).toPromise();
        this.businessId = createResponse!.id;
        
        // Mettre à jour l'utilisateur pour lier l'entreprise
        await this.http.patch(`${this.apiConfig.getUsersUrl()}/${this.userId}`, {
          businessId: this.businessId
        }).toPromise();
      }

      // Mettre à jour l'étape 1
      await this.http.patch(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}/step`, {
        step: 1,
        name: this.step1Form.value.name,
        sectorId: this.step1Form.value.sectorId
      }).toPromise();

      this.currentStep = 2;
      this.loading = false;
    } catch (err: any) {
      this.handleError(err);
    }
  }

  async onStep2Submit(): Promise<void> {
    if (this.step2Form.invalid || !this.businessId) {
      this.markFormGroupTouched(this.step2Form);
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      await this.http.patch(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}/step`, {
        step: 2,
        address: this.step2Form.value.address,
        phone: this.step2Form.value.phone,
        country: this.step2Form.value.country
      }).toPromise();

      this.currentStep = 3;
      this.loading = false;
    } catch (err: any) {
      this.handleError(err);
    }
  }

  async onStep3Submit(): Promise<void> {
    if (!this.businessId) return;

    this.loading = true;
    this.error = null;

    try {
      await this.http.patch(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}/step`, {
        step: 3,
        commerceRegisterNumber: this.step3Form.value.commerceRegisterNumber || null,
        identificationNumber: this.step3Form.value.identificationNumber || null
      }).toPromise();

      this.currentStep = 4;
      this.loading = false;
    } catch (err: any) {
      this.handleError(err);
    }
  }

  async onStep4Submit(): Promise<void> {
    if (this.step4Form.invalid || !this.businessId) {
      this.markFormGroupTouched(this.step4Form);
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      await this.http.patch(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}/step`, {
        step: 4,
        legalStatus: this.step4Form.value.legalStatus,
        bankAccountNumber: this.step4Form.value.bankAccountNumber || null,
        websiteUrl: this.step4Form.value.websiteUrl || null
      }).toPromise();

      this.currentStep = 5;
      this.loading = false;
    } catch (err: any) {
      this.handleError(err);
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.logoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreview = e.target?.result as string;
        this.updatePreview();
      };
      reader.readAsDataURL(this.logoFile);
    }
  }

  async onStep5Submit(): Promise<void> {
    if (!this.businessId) return;

    this.loading = true;
    this.error = null;

    try {
      let logoUrl: string | null = null;
      if (this.logoFile) {
        const formData = new FormData();
        formData.append('file', this.logoFile);
        const uploaded = await this.http.post<BusinessDto>(
          `${this.apiConfig.getBusinessesUrl()}/${this.businessId}/logo`,
          formData
        ).toPromise();
        logoUrl = uploaded?.logoUrl ?? null;
      }

      await this.http.patch(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}/step`, {
        step: 5,
        logoUrl
      }).toPromise();

      this.currentStep = 6;
    } catch (err: any) {
      this.handleError(err);
    } finally {
      this.loading = false;
    }
  }

  selectTemplate(template: ReceiptTemplateDto): void {
    this.selectedTemplate = template;
    this.updatePreview();
  }

  updatePreview(): void {
    if (!this.selectedTemplate) return;

    let html = this.selectedTemplate.htmlContent;
    const css = this.selectedTemplate.cssContent || '';

    // Remplacer les placeholders avec des données d'exemple
    html = html.replace(/\{\{logo\}\}/g, this.logoPreview || '');
    html = html.replace(/\{\{businessName\}\}/g, this.step1Form.value.name || 'Nom de l\'entreprise');
    html = html.replace(/\{\{address\}\}/g, this.step2Form.value.address || 'Adresse');
    html = html.replace(/\{\{phone\}\}/g, this.step2Form.value.phone || 'Téléphone');

    const fullHtml = `
      <style>${css}</style>
      ${html}
    `;

    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(fullHtml);
  }

  async onStep6Submit(): Promise<void> {
    if (!this.businessId || !this.selectedTemplate) {
      this.error = 'Veuillez sélectionner un template de reçu.';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      await this.http.patch(`${this.apiConfig.getBusinessesUrl()}/${this.businessId}/step`, {
        step: 6,
        receiptTemplateId: this.selectedTemplate.id
      }).toPromise();

      this.authService.updateUserBusinessId(this.businessId);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.handleError(err);
    } finally {
      this.loading = false;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return 'Ce champ est requis';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères`;

    return '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private handleError(error: any): void {
    this.loading = false;
    if (error.error?.message) {
      this.error = error.error.message;
    } else if (error.message) {
      this.error = error.message;
    } else {
      this.error = 'Une erreur est survenue.';
    }
  }
}
