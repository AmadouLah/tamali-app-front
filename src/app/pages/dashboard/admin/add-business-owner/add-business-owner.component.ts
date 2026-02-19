import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { UserDto } from '../../../../core/services/auth.service';

interface CreateBusinessOwnerRequest {
  email: string;
}

interface BusinessOwnerDto {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
  enabled: boolean;
  mustChangePassword?: boolean;
  businessId?: string;
  roles?: Array<{ id: string; type: string }>;
}

interface AssociateDto {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
  enabled: boolean;
  mustChangePassword?: boolean;
}

interface CreateAssociateRequest {
  email: string;
}

@Component({
  selector: 'app-add-business-owner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './add-business-owner.component.html',
  styleUrl: './add-business-owner.component.css'
})
export class AddBusinessOwnerComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly apiConfig = inject(ApiConfigService);

  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;

  form!: FormGroup;
  associateForm!: FormGroup;
  businessOwners: BusinessOwnerDto[] = [];
  filteredOwners: BusinessOwnerDto[] = [];
  associates: Map<string, AssociateDto[]> = new Map();
  searchQuery: string = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;
  showCreateModal = false;
  showAssociateModal = false;
  selectedOwnerId: string | null = null;
  activeMenu: string = 'ajouter propriétaire';
  sidebarOpen = false;

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
    this.initAssociateForm();
    this.loadBusinessOwners();
  }

  loadBusinessOwners(): void {
    this.loading = true;
    this.error = null;
    this.http.get<BusinessOwnerDto[]>(`${this.apiConfig.getUsersUrl()}/business-owners`).subscribe({
      next: (owners) => {
        this.businessOwners = owners;
        this.filteredOwners = owners;
        this.associates.clear();
        // Charger les associés pour chaque propriétaire qui a une entreprise
        const loadPromises = owners
          .filter(owner => owner.businessId)
          .map(owner => this.loadAssociates(owner.businessId!, owner.id));
        
        // Attendre que tous les associés soient chargés avant de désactiver le loading
        Promise.all(loadPromises).finally(() => {
          this.loading = false;
        });
      },
      error: (err) => {
        this.handleError(err);
        this.loading = false;
      }
    });
  }

  private loadAssociates(businessId: string, ownerId: string): Promise<void> {
    return new Promise((resolve) => {
      this.http.get<AssociateDto[]>(`${this.apiConfig.getUsersUrl()}/business/${businessId}/associates`).subscribe({
        next: (associates) => {
          this.associates.set(ownerId, associates);
          resolve();
        },
        error: () => {
          // Ignorer les erreurs silencieusement pour ne pas perturber l'interface
          resolve();
        }
      });
    });
  }

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.filteredOwners = this.businessOwners;
      return;
    }
    const query = this.searchQuery.toLowerCase().trim();
    this.filteredOwners = this.businessOwners.filter(owner => 
      owner.email.toLowerCase().includes(query) ||
      owner.firstname?.toLowerCase().includes(query) ||
      owner.lastname?.toLowerCase().includes(query) ||
      `${owner.firstname || ''} ${owner.lastname || ''}`.toLowerCase().includes(query)
    );
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.form.reset();
    this.error = null;
    this.success = null;
    // Focus sur le champ email après l'ouverture de la modale
    setTimeout(() => {
      if (this.emailInput) {
        this.emailInput.nativeElement.focus();
      }
    }, 100);
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.form.reset();
    this.error = null;
    this.success = null;
  }

  getFullName(owner: BusinessOwnerDto | AssociateDto): string {
    if (owner.firstname || owner.lastname) {
      return `${owner.firstname || ''} ${owner.lastname || ''}`.trim();
    }
    return owner.email;
  }

  toggleOwnerStatus(owner: BusinessOwnerDto): void {
    if (!confirm(`Êtes-vous sûr de vouloir ${owner.enabled ? 'désactiver' : 'activer'} ce compte ?`)) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    
    const action = owner.enabled 
      ? this.http.patch(`${this.apiConfig.getUsersUrl()}/${owner.id}/disable`, {})
      : this.http.patch(`${this.apiConfig.getUsersUrl()}/${owner.id}/enable`, {});

    action.subscribe({
      next: () => {
        this.success = `Compte ${owner.enabled ? 'désactivé' : 'activé'} avec succès`;
        this.loading = false;
        this.loadBusinessOwners();
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  deleteOwner(owner: BusinessOwnerDto): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le compte de ${this.getFullName(owner)} ? Cette action est irréversible.`)) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    
    this.http.delete(`${this.apiConfig.getUsersUrl()}/${owner.id}`).subscribe({
      next: () => {
        this.success = 'Propriétaire supprimé avec succès';
        this.loading = false;
        this.loadBusinessOwners();
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private initForm(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  private initAssociateForm(): void {
    this.associateForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
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

    const request: CreateBusinessOwnerRequest = {
      email: this.form.value.email.trim()
    };

    this.http.post(`${this.apiConfig.getUsersUrl()}/business-owner`, request).subscribe({
      next: () => {
        this.success = 'Propriétaire d\'entreprise créé avec succès !';
        this.loading = false;
        this.form.reset();
        this.closeCreateModal();
        this.loadBusinessOwners();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private handleError(err: any): void {
    this.loading = false;
    this.error = err.error?.message || 'Une erreur est survenue lors de la création.';
    setTimeout(() => {
      this.error = null;
    }, 5000);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getFieldError(fieldName: string, form: FormGroup = this.form): string {
    const field = form.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return 'Ce champ est requis';
    if (field.errors['email']) return 'Email invalide';
    
    return '';
  }

  isFieldInvalid(fieldName: string, form: FormGroup = this.form): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  openAssociateModal(owner: BusinessOwnerDto): void {
    if (!owner.businessId) {
      this.error = 'Ce propriétaire n\'a pas d\'entreprise associée. Vous devez d\'abord compléter les 6 étapes de création d\'entreprise.';
      setTimeout(() => this.error = null, 5000);
      return;
    }
    this.selectedOwnerId = owner.id;
    this.showAssociateModal = true;
    this.associateForm.reset();
    this.error = null;
    this.success = null;
    // Attendre que la modale soit rendue avant de focus
    setTimeout(() => {
      const emailInput = document.querySelector('#associate-email-input') as HTMLInputElement;
      if (emailInput) {
        emailInput.focus();
      }
    }, 150);
  }

  closeAssociateModal(): void {
    this.showAssociateModal = false;
    this.selectedOwnerId = null;
    this.associateForm.reset();
    this.error = null;
    this.success = null;
  }

  onSubmitAssociate(): void {
    if (this.associateForm.invalid || this.loading || !this.selectedOwnerId) {
      this.markFormGroupTouched(this.associateForm);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    const request: CreateAssociateRequest = {
      email: this.associateForm.value.email.trim()
    };

    // Sauvegarder les informations du propriétaire avant de fermer la modale
    const ownerId = this.selectedOwnerId;
    const owner = this.businessOwners.find(o => o.id === ownerId);
    const ownerBusinessId = owner?.businessId;

    this.http.post<UserDto>(`${this.apiConfig.getUsersUrl()}/${ownerId}/associate`, request).subscribe({
      next: (createdAssociate) => {
        this.success = 'Associé créé avec succès !';
        this.associateForm.reset();
        this.closeAssociateModal();
        
        // Recharger directement les associés du propriétaire concerné
        if (ownerBusinessId && ownerId) {
          this.loadAssociates(ownerBusinessId, ownerId).then(() => {
            this.loading = false;
            setTimeout(() => {
              this.success = null;
            }, 3000);
          });
        } else {
          // Si on n'a pas le businessId, recharger tous les propriétaires
          this.loadBusinessOwners();
          setTimeout(() => {
            this.success = null;
          }, 3000);
        }
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  getAssociates(ownerId: string): AssociateDto[] {
    return this.associates.get(ownerId) || [];
  }

  hasAssociates(ownerId: string): boolean {
    return this.associates.has(ownerId) && this.associates.get(ownerId)!.length > 0;
  }
}
