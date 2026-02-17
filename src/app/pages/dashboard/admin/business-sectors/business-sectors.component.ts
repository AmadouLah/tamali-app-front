import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { AdminSidebarComponent, MenuItem } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';

interface BusinessSectorDto {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

interface BusinessSectorCreateRequest {
  name: string;
  description?: string;
}

interface BusinessSectorUpdateRequest {
  name?: string;
  description?: string;
  active?: boolean;
}

@Component({
  selector: 'app-business-sectors',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './business-sectors.component.html',
  styleUrl: './business-sectors.component.css'
})
export class BusinessSectorsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  private readonly apiConfig = inject(ApiConfigService);

  sectors: BusinessSectorDto[] = [];
  form!: FormGroup;
  editForm!: FormGroup;
  editingId: string | null = null;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu: string = 'secteurs d\'activité';

  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'grid', route: '/dashboard/admin' },
    { label: 'Ajouter Propriétaire', icon: 'user-plus', route: '/dashboard/admin/add-business-owner' },
    { label: 'Secteurs d\'activité', icon: 'briefcase', route: '/dashboard/admin/business-sectors' },
    { label: 'Mon Compte', icon: 'user', route: '/dashboard/admin/account' },
    { label: 'Performance', icon: 'chart-up' },
    { label: 'Statistics', icon: 'bar-chart' },
    { label: 'Analytics', icon: 'line-chart' },
    { label: 'Payments', icon: 'credit-card', badge: 3 },
    { label: 'Help', icon: 'help-circle' },
    { label: 'Settings', icon: 'settings' }
  ];

  ngOnInit(): void {
    this.initForm();
    this.initEditForm();
    this.loadSectors();
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['']
    });
  }

  private initEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      active: [true]
    });
  }

  loadSectors(): void {
    this.loading = true;
    this.http.get<BusinessSectorDto[]>(this.apiConfig.getBusinessSectorsUrl()).subscribe({
      next: (data) => {
        this.sectors = data;
        this.loading = false;
      },
      error: (err) => {
        this.handleError(err);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading) {
      this.markFormGroupTouched(this.form);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    const request: BusinessSectorCreateRequest = {
      name: this.form.value.name.trim(),
      description: this.form.value.description?.trim() || undefined
    };

    this.http.post<BusinessSectorDto>(this.apiConfig.getBusinessSectorsUrl(), request).subscribe({
      next: () => {
        this.success = 'Secteur d\'activité créé avec succès';
        this.form.reset();
        this.loadSectors();
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  startEdit(sector: BusinessSectorDto): void {
    this.editingId = sector.id;
    this.editForm.patchValue({
      name: sector.name,
      description: sector.description || '',
      active: sector.active
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editForm.reset();
  }

  onUpdate(sectorId: string): void {
    if (this.editForm.invalid) {
      this.markFormGroupTouched(this.editForm);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    const request: BusinessSectorUpdateRequest = {
      name: this.editForm.value.name.trim(),
      description: this.editForm.value.description?.trim() || undefined,
      active: this.editForm.value.active
    };

    this.http.patch<BusinessSectorDto>(`${this.apiConfig.getBusinessSectorsUrl()}/${sectorId}`, request).subscribe({
      next: () => {
        this.success = 'Secteur d\'activité mis à jour avec succès';
        this.editingId = null;
        this.loadSectors();
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  onDelete(sectorId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce secteur d\'activité ?')) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.http.delete(`${this.apiConfig.getBusinessSectorsUrl()}/${sectorId}`).subscribe({
      next: () => {
        this.success = 'Secteur d\'activité supprimé avec succès';
        this.loadSectors();
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
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
      this.error = 'Une erreur est survenue';
    }
    setTimeout(() => this.error = null, 5000);
  }
}
