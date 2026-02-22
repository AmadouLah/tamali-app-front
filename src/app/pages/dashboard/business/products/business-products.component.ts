import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import { ProductCategoryStoreService } from '../../../../core/services/product-category-store.service';
import { IndexedDbService } from '../../../../core/services/indexed-db.service';
import {
  ProductDto,
  ProductCategoryDto,
  ProductCreateRequest,
  ProductUpdateRequest
} from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { extractErrorMessage } from '../../../../core/utils/error.utils';

@Component({
  selector: 'app-business-products',
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
  templateUrl: './business-products.component.html',
  styleUrl: './business-products.component.css'
})
export class BusinessProductsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly categoryStore = inject(ProductCategoryStoreService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dbService = inject(IndexedDbService);
  private categoryStoreSub?: Subscription;

  user: UserDto | null = null;
  businessId: string | null = null;
  products: ProductDto[] = [];
  localProducts: ProductDto[] = [];
  categories: ProductCategoryDto[] = [];
  form!: FormGroup;
  editForm!: FormGroup;
  editingId: string | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'produits';
  sidebarOpen = false;
  showAddModal = false;
  searchQuery = '';

  menuItems = getBusinessMenuItems(null);
  isReadOnly = false;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.menuItems = getBusinessMenuItems(this.user);
    this.isReadOnly = this.authService.isBusinessAssociate(this.user);
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
    this.categoryStoreSub = this.categoryStore.categories$.subscribe(() => {
      this.categoriesVersion++;
    });
    this.loadCategories();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.categoryStoreSub?.unsubscribe();
  }

  /** Incrémenté à chaque mise à jour du store pour forcer le recalcul de productsByCategory. */
  categoriesVersion = 0;

  private buildForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      reference: [''],
      categoryId: [''],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      taxable: [false]
    });
    
    // Appliquer la TVA de 18% quand taxable est activé
    let previousTaxableValue = false;
    this.form.get('taxable')?.valueChanges.subscribe(taxable => {
      const unitPriceControl = this.form.get('unitPrice');
      if (unitPriceControl && unitPriceControl.value && unitPriceControl.value > 0) {
        const currentPrice = Number(unitPriceControl.value);
        // Ne recalculer que si on change l'état de taxable (pas à chaque modification)
        if (taxable !== previousTaxableValue) {
          if (taxable && !previousTaxableValue) {
            // Si on active taxable, appliquer 18% de TVA (prix TTC = prix HT * 1.18)
            const priceWithTax = currentPrice * 1.18;
            unitPriceControl.setValue(Math.round(priceWithTax * 100) / 100, { emitEvent: false });
          } else if (!taxable && previousTaxableValue) {
            // Si on désactive taxable, retirer la TVA (prix HT = prix TTC / 1.18)
            const priceWithoutTax = currentPrice / 1.18;
            unitPriceControl.setValue(Math.round(priceWithoutTax * 100) / 100, { emitEvent: false });
          }
          previousTaxableValue = taxable;
        }
      } else {
        previousTaxableValue = taxable;
      }
    });
  }

  private buildEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      reference: [''],
      categoryId: [''],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      taxable: [false]
    });
    
    // Appliquer la TVA de 18% quand taxable est activé
    let previousTaxableValue = false;
    this.editForm.get('taxable')?.valueChanges.subscribe(taxable => {
      const unitPriceControl = this.editForm.get('unitPrice');
      if (unitPriceControl && unitPriceControl.value && unitPriceControl.value > 0) {
        const currentPrice = Number(unitPriceControl.value);
        // Ne recalculer que si on change l'état de taxable (pas à chaque modification)
        if (taxable !== previousTaxableValue) {
          if (taxable && !previousTaxableValue) {
            // Si on active taxable, appliquer 18% de TVA (prix TTC = prix HT * 1.18)
            const priceWithTax = currentPrice * 1.18;
            unitPriceControl.setValue(Math.round(priceWithTax * 100) / 100, { emitEvent: false });
          } else if (!taxable && previousTaxableValue) {
            // Si on désactive taxable, retirer la TVA (prix HT = prix TTC / 1.18)
            const priceWithoutTax = currentPrice / 1.18;
            unitPriceControl.setValue(Math.round(priceWithoutTax * 100) / 100, { emitEvent: false });
          }
          previousTaxableValue = taxable;
        }
      } else {
        previousTaxableValue = taxable;
      }
    });
  }

  private async loadCategories(): Promise<void> {
    if (!this.businessId) return;
    this.businessOps.getProductCategories(this.businessId).subscribe({
      next: async (list) => {
        this.categories = list;
        this.categoryStore.setCategories(this.businessId!, list);
        // Recharger les produits locaux pour mettre à jour les noms de catégories
        await this.loadLocalProducts();
      }
    });
  }

  private async loadProducts(): Promise<void> {
    if (!this.businessId) return;
    this.businessOps.getProducts(this.businessId).subscribe({
      next: async (list) => {
        this.products = list;
        await this.loadLocalProducts();
        this.loading = false;
      },
      error: async () => {
        await this.loadLocalProducts();
        this.loading = false;
      }
    });
  }

  private async loadLocalProducts(): Promise<void> {
    if (!this.businessId) return;
    
    try {
      // Charger les produits créés localement
      const localProductsData = await this.dbService.getLocalProducts(this.businessId);
      const createdProducts = localProductsData
        .filter(lp => !lp.synced)
        .map(lp => {
          const product = lp.product as any;
          const category = this.categories.find(c => c.id === product.categoryId);
          return {
            ...product,
            id: lp.id,
            categoryName: category?.name,
            isLocal: true,
            operation: 'POST'
          } as ProductDto & { isLocal?: boolean; operation?: string };
        });
      
      // Charger les modifications/suppressions : uniquement celles du business actuel (exclure les données orphelines)
      const allLocalEntities = await this.dbService.getLocalEntities('product', '');
      const localEntities = allLocalEntities.filter(le =>
        le.businessId === this.businessId ||
        (!le.businessId && this.products.some(p => p.id === le.entityId))
      );
      
      const modifiedProducts = localEntities
        .filter(le => le.operation === 'PATCH')
        .map(le => {
          const existingProduct = this.products.find(p => p.id === le.entityId);
          if (!existingProduct) return null;
          const updates = le.entity as any;
          return {
            ...existingProduct,
            ...updates,
            isLocal: true,
            operation: 'PATCH'
          } as ProductDto & { isLocal?: boolean; operation?: string };
        })
        .filter((p): p is ProductDto & { isLocal?: boolean; operation?: string } => p !== null);
      
      // Charger les produits marqués pour suppression
      const deletedProducts = localEntities
        .filter(le => le.operation === 'DELETE')
        .map(le => {
          const existingProduct = this.products.find(p => p.id === le.entityId);
          if (!existingProduct) return null;
          return {
            ...existingProduct,
            isLocal: true,
            operation: 'DELETE'
          } as ProductDto & { isLocal?: boolean; operation?: string };
        })
        .filter((p): p is ProductDto & { isLocal?: boolean; operation?: string } => p !== null);
      
      this.localProducts = [...createdProducts, ...modifiedProducts, ...deletedProducts];
    } catch (error) {
      console.error('Erreur lors du chargement des produits locaux:', error);
    }
  }

  get allProducts(): (ProductDto & { isLocal?: boolean; operation?: string })[] {
    // Exclure les produits supprimés de la liste principale
    const deletedIds = new Set(
      this.localProducts
        .filter(p => (p as ProductDto & { operation?: string }).operation === 'DELETE')
        .map(p => p.id)
    );
    const activeProducts = this.products.filter(p => !deletedIds.has(p.id));
    
    // Combiner produits actifs et produits locaux
    const combined = [...activeProducts, ...this.localProducts];
    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredProducts(): (ProductDto & { isLocal?: boolean; operation?: string })[] {
    const q = this.searchQuery?.trim().toLowerCase() ?? '';
    if (!q) return this.allProducts;
    const nameFor = (p: ProductDto) => this.categoryStore.getCategoryName(p.categoryId) || p.categoryName || '';
    return this.allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q) ||
      nameFor(p).toLowerCase().includes(q)
    );
  }

  get productsByCategory(): { category: string; products: (ProductDto & { isLocal?: boolean; operation?: string })[] }[] {
    const map = new Map<string, (ProductDto & { isLocal?: boolean; operation?: string })[]>();
    for (const p of this.filteredProducts) {
      const cat = (this.categoryStore.getCategoryName(p.categoryId) || p.categoryName?.trim() || '').trim() || 'Sans catégorie';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).map(([category, products]) => ({ category, products }));
  }

  openAdd(): void {
    this.form.reset({ name: '', reference: '', categoryId: '', unitPrice: 0, purchasePrice: 0, taxable: false });
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
    const v = this.form.value as ProductCreateRequest;
    const name = (v.name || '').trim();
    const existingNames = this.allProducts
      .filter(p => (p as ProductDto & { operation?: string }).operation !== 'DELETE')
      .map(p => (p.name || '').trim().toLowerCase());
    if (existingNames.includes(name.toLowerCase())) {
      this.error = 'Un produit avec ce nom existe déjà.';
      this.submitting = false;
      return;
    }
    const body = {
      name: v.name,
      reference: v.reference || undefined,
      categoryId: v.categoryId || undefined,
      unitPrice: Number(v.unitPrice),
      purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : undefined,
      taxable: !!v.taxable,
      initialQuantity: 0
    };
    this.businessOps.createProduct(this.businessId, body).subscribe({
      next: async (result) => {
        if (isPendingResponse(result)) {
          this.success = 'Produit ajouté localement. Synchronisation à la reconnexion.';
          await this.loadLocalProducts();
        } else {
          this.success = 'Produit ajouté.';
        }
        await this.loadProducts();
        this.closeAdd();
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de l\'ajout.');
        this.submitting = false;
      }
    });
  }

  startEdit(p: ProductDto & { isLocal?: boolean; operation?: string }): void {
    if (p.isLocal && (p.operation === 'DELETE' || p.operation === 'PATCH')) return;
    this.editingId = p.id;
    // Si le produit est taxable, le prix stocké est déjà TTC, donc on le garde tel quel
    // Sinon, c'est le prix HT
    this.editForm.patchValue({
      name: p.name,
      reference: p.reference ?? '',
      categoryId: p.categoryId ?? '',
      unitPrice: p.unitPrice,
      purchasePrice: p.purchasePrice ?? 0,
      taxable: p.taxable
    }, { emitEvent: false });
    this.error = null;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  async submitEdit(): Promise<void> {
    if (!this.editingId || this.editForm.invalid || this.submitting) return;
    this.error = null;
    this.submitting = true;
    const v = this.editForm.value as ProductUpdateRequest;
    const body = {
      name: v.name,
      reference: v.reference || undefined,
      categoryId: v.categoryId || undefined,
      unitPrice: Number(v.unitPrice),
      purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : undefined,
      taxable: !!v.taxable
    };
    this.businessOps.updateProduct(this.editingId, body).subscribe({
      next: async (result) => {
        if (isPendingResponse(result)) {
          this.success = 'Produit mis à jour localement. Synchronisation à la reconnexion.';
          await this.loadLocalProducts();
        } else {
          this.success = 'Produit mis à jour.';
        }
        await this.loadProducts();
        this.editingId = null;
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de la mise à jour.');
        this.submitting = false;
      }
    });
  }

  async deleteProduct(p: ProductDto & { isLocal?: boolean; operation?: string }): Promise<void> {
    if (p.isLocal && p.operation === 'DELETE') return;
    if (!confirm(`Supprimer « ${p.name } » ?`)) return;
    this.businessOps.deleteProduct(p.id).subscribe({
      next: async (result) => {
        if (isPendingResponse(result)) {
          this.success = 'Produit marqué pour suppression. Synchronisation à la reconnexion.';
          await this.loadLocalProducts();
        } else {
          this.success = 'Produit supprimé.';
        }
        await this.loadProducts();
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de la suppression.');
      }
    });
  }

  formatMoney(amount: number): string {
    return `${(amount ?? 0).toLocaleString('fr-FR')} FCFA`;
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  getProductBorderClass(p: ProductDto & { isLocal?: boolean; operation?: string }): Record<string, boolean> {
    if (p.isLocal && p.operation === 'DELETE') {
      return { 'border-red-500/50': true };
    } else if (p.isLocal) {
      return { 'border-yellow-500/50': true };
    }
    return { 'border-white/10': true };
  }
}
