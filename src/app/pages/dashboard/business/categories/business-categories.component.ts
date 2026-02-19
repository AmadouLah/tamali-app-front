import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import type { ProductCategoryDto } from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { extractErrorMessage } from '../../../../core/utils/error.utils';

@Component({
  selector: 'app-business-categories',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-categories.component.html',
  styleUrl: './business-categories.component.css'
})
export class BusinessCategoriesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user: UserDto | null = null;
  businessId: string | null = null;
  categories: ProductCategoryDto[] = [];
  form!: FormGroup;
  editForm!: FormGroup;
  editingId: string | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'catégories';
  sidebarOpen = false;
  showAddModal = false;

  readonly menuItems = BUSINESS_OWNER_MENU_ITEMS;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.user?.roles?.some(r => r.type === 'BUSINESS_OWNER') || !this.user.businessId) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.businessId = this.user.businessId;
    this.buildForm();
    this.buildEditForm();
    this.loadCategories();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  private buildEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  private loadCategories(): void {
    if (!this.businessId) return;
    this.businessOps.getProductCategories(this.businessId).subscribe({
      next: (list) => {
        this.categories = list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openAdd(): void {
    this.form.reset({ name: '' });
    this.showAddModal = true;
    this.error = null;
  }

  closeAdd(): void {
    this.showAddModal = false;
  }

  submitAdd(): void {
    if (!this.businessId || this.form.invalid || this.submitting) return;
    this.error = null;
    this.submitting = true;
    const name = this.form.value.name?.trim();
    this.businessOps.createProductCategory(this.businessId, name).subscribe({
      next: (result) => {
        this.loadCategories();
        this.closeAdd();
        this.success = isPendingResponse(result) ? 'Catégorie ajoutée. Synchronisation à la reconnexion.' : 'Catégorie ajoutée.';
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de l\'ajout.');
        this.submitting = false;
      }
    });
  }

  startEdit(cat: ProductCategoryDto): void {
    this.editingId = cat.id;
    this.editForm.patchValue({ name: cat.name });
    this.error = null;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  submitEdit(): void {
    if (!this.editingId || this.editForm.invalid || this.submitting) return;
    this.error = null;
    this.submitting = true;
    const name = this.editForm.value.name?.trim();
    this.businessOps.updateProductCategory(this.editingId, name).subscribe({
      next: (result) => {
        this.loadCategories();
        this.editingId = null;
        this.success = isPendingResponse(result) ? 'Catégorie mise à jour. Synchronisation à la reconnexion.' : 'Catégorie mise à jour.';
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de la mise à jour.');
        this.submitting = false;
      }
    });
  }

  deleteCategory(cat: ProductCategoryDto): void {
    if (!confirm(`Supprimer la catégorie « ${cat.name } » ? Les produits de cette catégorie resteront mais seront sans catégorie.`)) return;
    this.businessOps.deleteProductCategory(cat.id).subscribe({
      next: (result) => {
        this.loadCategories();
        this.success = isPendingResponse(result) ? 'Catégorie supprimée. Synchronisation à la reconnexion.' : 'Catégorie supprimée.';
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de la suppression.');
      }
    });
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }
}
