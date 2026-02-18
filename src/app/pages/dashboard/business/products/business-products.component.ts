import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import {
  ProductDto,
  ProductCreateRequest,
  ProductUpdateRequest
} from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { extractErrorMessage } from '../../../../core/utils/error.utils';

@Component({
  selector: 'app-business-products',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-products.component.html',
  styleUrl: './business-products.component.css'
})
export class BusinessProductsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user: UserDto | null = null;
  businessId: string | null = null;
  products: ProductDto[] = [];
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
    this.loadProducts();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      reference: [''],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      taxable: [false],
      initialQuantity: [0, [Validators.required, Validators.min(0)]]
    });
  }

  private buildEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      reference: [''],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      taxable: [false]
    });
  }

  private loadProducts(): void {
    if (!this.businessId) return;
    this.businessOps.getProducts(this.businessId).subscribe({
      next: (list) => {
        this.products = list;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get productsByCategory(): { category: string; products: ProductDto[] }[] {
    const map = new Map<string, ProductDto[]>();
    for (const p of this.products) {
      const cat = p.reference?.trim() || 'Sans catégorie';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).map(([category, products]) => ({ category, products }));
  }

  openAdd(): void {
    this.form.reset({ name: '', reference: '', unitPrice: 0, taxable: false, initialQuantity: 0 });
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
    const v = this.form.value as ProductCreateRequest;
    const body = {
      name: v.name,
      reference: v.reference || undefined,
      unitPrice: Number(v.unitPrice),
      taxable: !!v.taxable,
      initialQuantity: Math.max(0, Number(v.initialQuantity) || 0)
    };
    this.businessOps.createProduct(this.businessId, body).subscribe({
      next: (result) => {
        this.loadProducts();
        this.closeAdd();
        this.success = isPendingResponse(result) ? 'Produit ajouté. Synchronisation à la reconnexion.' : 'Produit ajouté.';
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de l\'ajout.');
        this.submitting = false;
      }
    });
  }

  startEdit(p: ProductDto): void {
    this.editingId = p.id;
    this.editForm.patchValue({
      name: p.name,
      reference: p.reference ?? '',
      unitPrice: p.unitPrice,
      taxable: p.taxable
    });
    this.error = null;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  submitEdit(): void {
    if (!this.editingId || this.editForm.invalid || this.submitting) return;
    this.error = null;
    this.submitting = true;
    const v = this.editForm.value as ProductUpdateRequest;
    const body = {
      name: v.name,
      reference: v.reference || undefined,
      unitPrice: Number(v.unitPrice),
      taxable: !!v.taxable
    };
    this.businessOps.updateProduct(this.editingId, body).subscribe({
      next: (result) => {
        this.loadProducts();
        this.editingId = null;
        this.success = isPendingResponse(result) ? 'Produit mis à jour. Synchronisation à la reconnexion.' : 'Produit mis à jour.';
        this.submitting = false;
      },
      error: (err) => {
        this.error = extractErrorMessage(err, 'Erreur lors de la mise à jour.');
        this.submitting = false;
      }
    });
  }

  deleteProduct(p: ProductDto): void {
    if (!confirm(`Supprimer « ${p.name } » ?`)) return;
    this.businessOps.deleteProduct(p.id).subscribe({
      next: (result) => {
        this.loadProducts();
        this.success = isPendingResponse(result) ? 'Produit supprimé. Synchronisation à la reconnexion.' : 'Produit supprimé.';
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
}
