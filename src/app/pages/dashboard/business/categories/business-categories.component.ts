import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import { ProductCategoryStoreService } from '../../../../core/services/product-category-store.service';
import { IndexedDbService } from '../../../../core/services/indexed-db.service';
import type { ProductCategoryDto } from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { extractErrorMessage } from '../../../../core/utils/error.utils';

@Component({
  selector: 'app-business-categories',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  private readonly categoryStore = inject(ProductCategoryStoreService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dbService = inject(IndexedDbService);

  user: UserDto | null = null;
  businessId: string | null = null;
  categories: ProductCategoryDto[] = [];
  localCategories: ProductCategoryDto[] = [];
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
  searchQuery = '';

  menuItems = getBusinessMenuItems(null);

  get filteredCategories(): (ProductCategoryDto & { isLocal?: boolean; operation?: string })[] {
    const q = this.searchQuery?.trim().toLowerCase() ?? '';
    const allCategories = this.allCategories;
    if (!q) return allCategories;
    return allCategories.filter(c => c.name.toLowerCase().includes(q));
  }

  get allCategories(): (ProductCategoryDto & { isLocal?: boolean; operation?: string })[] {
    // Exclure les catégories supprimées de la liste principale
    const deletedIds = new Set(
      this.localCategories
        .filter(c => (c as ProductCategoryDto & { operation?: string }).operation === 'DELETE')
        .map(c => c.id)
    );
    const activeCategories = this.categories.filter(c => !deletedIds.has(c.id));
    
    // Combiner catégories actives et catégories locales
    const combined = [...activeCategories, ...this.localCategories];
    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.menuItems = getBusinessMenuItems(this.user);
    if (this.authService.isBusinessAssociate(this.user)) {
      this.router.navigate(['/dashboard/business']);
      return;
    }
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      if (this.user && this.authService.shouldRedirectToSetup(this.user)) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    this.businessId = this.user?.businessId ?? null;
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

  private async loadCategories(): Promise<void> {
    if (!this.businessId) return;
    this.businessOps.getProductCategories(this.businessId).subscribe({
      next: async (list) => {
        this.categories = list;
        this.categoryStore.setCategories(this.businessId!, list);
        await this.loadLocalCategories();
        this.loading = false;
      },
      error: async () => {
        await this.loadLocalCategories();
        this.loading = false;
      }
    });
  }

  private async loadLocalCategories(): Promise<void> {
    if (!this.businessId) return;
    
    try {
      // Charger toutes les entités locales de type category (même sans businessId)
      const allLocalEntities = await this.dbService.getLocalEntities('category', '');
      // Filtrer celles qui appartiennent à ce businessId ou qui n'ont pas de businessId (seront vérifiées par ID)
      const localEntities = allLocalEntities.filter(le => 
        !le.businessId || le.businessId === this.businessId || 
        this.categories.some(c => c.id === le.entityId)
      );
      
      this.localCategories = localEntities.map(le => {
        const category = le.entity as any;
        // Pour les modifications/suppressions, utiliser le nom de la catégorie existante si disponible
        const existingCategory = this.categories.find(c => c.id === le.entityId);
        const categoryName = category.name || existingCategory?.name || '';
        
        return {
          id: le.entityId,
          name: categoryName,
          businessId: le.businessId || existingCategory?.businessId || this.businessId!,
          isLocal: true,
          operation: le.operation
        } as ProductCategoryDto & { isLocal?: boolean; operation?: string };
      });
    } catch (error) {
      console.error('Erreur lors du chargement des catégories locales:', error);
    }
  }

  openAdd(): void {
    this.form.reset({ name: '' });
    this.showAddModal = true;
    this.error = null;
  }

  closeAdd(): void {
    this.showAddModal = false;
  }

  async submitAdd(): Promise<void> {
    if (!this.businessId || this.form.invalid || this.submitting) return;
    this.error = null;
    this.submitting = true;
    const name = this.form.value.name?.trim();
    const existingNames = this.allCategories
      .filter(c => (c as { operation?: string }).operation !== 'DELETE')
      .map(c => c.name.trim().toLowerCase());
    if (existingNames.includes(name.toLowerCase())) {
      this.error = 'Une catégorie avec ce nom existe déjà.';
      this.submitting = false;
      return;
    }
    this.businessOps.createProductCategory(this.businessId, name).subscribe({
      next: async (result) => {
        if (isPendingResponse(result)) {
          this.success = 'Catégorie ajoutée localement. Synchronisation à la reconnexion.';
          await this.loadLocalCategories();
        } else {
          this.success = 'Catégorie ajoutée.';
        }
        await this.loadCategories();
        this.closeAdd();
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de l\'ajout.');
        this.submitting = false;
      }
    });
  }

  startEdit(cat: ProductCategoryDto & { isLocal?: boolean; operation?: string }): void {
    if (cat.isLocal && cat.operation === 'PATCH') return;
    this.editingId = cat.id;
    this.editForm.patchValue({ name: cat.name });
    this.error = null;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  async submitEdit(): Promise<void> {
    if (!this.editingId || this.editForm.invalid || this.submitting) return;
    this.error = null;
    this.submitting = true;
    const name = this.editForm.value.name?.trim();
    this.businessOps.updateProductCategory(this.editingId, name).subscribe({
      next: async (result) => {
        if (isPendingResponse(result)) {
          this.success = 'Catégorie mise à jour localement. Synchronisation à la reconnexion.';
          await this.loadLocalCategories();
        } else {
          this.categoryStore.updateCategory(this.editingId!, name);
          this.success = 'Catégorie mise à jour.';
        }
        await this.loadCategories();
        this.editingId = null;
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de la mise à jour.');
        this.submitting = false;
      }
    });
  }

  async deleteCategory(cat: ProductCategoryDto & { isLocal?: boolean; operation?: string }): Promise<void> {
    if (cat.isLocal && cat.operation === 'DELETE') return;
    
    this.businessOps.getProductCategoryProductsCount(cat.id).subscribe({
      next: async (count) => {
        const message = count > 0
          ? `ATTENTION : Supprimer la catégorie « ${cat.name} » supprimera définitivement ${count} produit${count > 1 ? 's' : ''} associé${count > 1 ? 's' : ''}.\n\nCette action est irréversible. Êtes-vous sûr de vouloir continuer ?`
          : `Supprimer la catégorie « ${cat.name} » ?`;
        
        if (!confirm(message)) return;
        
        this.businessOps.deleteProductCategory(cat.id).subscribe({
          next: async (result) => {
            if (isPendingResponse(result)) {
              this.success = `Catégorie${count > 0 ? ` et ${count} produit${count > 1 ? 's' : ''}` : ''} marquée pour suppression. Synchronisation à la reconnexion.`;
              await this.loadLocalCategories();
            } else {
              this.categoryStore.removeCategory(cat.id);
              this.success = `Catégorie${count > 0 ? ` et ${count} produit${count > 1 ? 's' : ''}` : ''} supprimée${count > 0 ? 's' : ''}.`;
            }
            await this.loadCategories();
          },
          error: (err) => {
            this.error = extractErrorMessage(err, 'Erreur lors de la suppression.');
          }
        });
      },
      error: async (err) => {
        const message = `Supprimer la catégorie « ${cat.name} » supprimera tous les produits associés.\n\nCette action est irréversible. Êtes-vous sûr de vouloir continuer ?`;
        if (!confirm(message)) return;
        
        this.businessOps.deleteProductCategory(cat.id).subscribe({
          next: async (result) => {
            if (isPendingResponse(result)) {
              this.success = 'Catégorie marquée pour suppression. Synchronisation à la reconnexion.';
              await this.loadLocalCategories();
            } else {
              this.categoryStore.removeCategory(cat.id);
              this.success = 'Catégorie supprimée.';
            }
            await this.loadCategories();
          },
          error: (deleteErr) => {
            this.error = extractErrorMessage(deleteErr, 'Erreur lors de la suppression.');
          }
        });
      }
    });
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  getCategoryBorderClass(cat: ProductCategoryDto & { isLocal?: boolean; operation?: string }): Record<string, boolean> {
    if (cat.isLocal && cat.operation === 'DELETE') {
      return { 'border-red-500/50': true };
    } else if (cat.isLocal) {
      return { 'border-yellow-500/50': true };
    }
    return { 'border-white/10': true };
  }
}
