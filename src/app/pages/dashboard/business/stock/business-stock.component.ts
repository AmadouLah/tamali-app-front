import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import { IndexedDbService } from '../../../../core/services/indexed-db.service';
import {
  ProductDto,
  StockMovementCreateRequest,
  MovementType
} from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';
import { getBusinessMenuItems } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-business-stock',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-stock.component.html',
  styleUrl: './business-stock.component.css'
})
export class BusinessStockComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dbService = inject(IndexedDbService);
  private readonly toast = inject(ToastService);

  user: UserDto | null = null;
  businessId: string | null = null;
  products: ProductDto[] = [];
  availableStocks: Map<string, number> = new Map();
  stockForm!: FormGroup;
  stockProductId: string | null = null;
  loading = true;
  submitting = false;
  activeMenu = 'stock';
  sidebarOpen = false;

  menuItems = getBusinessMenuItems(null);
  isEntryOnly = false;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.menuItems = getBusinessMenuItems(this.user);
    this.isEntryOnly = this.authService.isBusinessAssociate(this.user);
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      if (this.user && this.authService.shouldRedirectToSetup(this.user)) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    this.businessId = this.user?.businessId ?? null;
    this.buildStockForm();
    this.loadProducts();
  }

  private buildStockForm(): void {
    this.stockForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1)]],
      type: ['IN' as MovementType, Validators.required]
    });
  }

  private async loadProducts(): Promise<void> {
    if (!this.businessId) return;
    this.businessOps.getProducts(this.businessId).subscribe({
      next: async (list) => {
        this.products = list;
        await this.updateAvailableStocks();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private async updateAvailableStocks(): Promise<void> {
    this.availableStocks.clear();
    for (const product of this.products) {
      const available = await this.dbService.getAvailableStock(product.id, product.stockQuantity);
      this.availableStocks.set(product.id, available);
    }
  }

  getAvailableStockForProduct(productId: string): number {
    return this.availableStocks.get(productId) ?? 0;
  }

  openStock(p: ProductDto): void {
    this.stockProductId = p.id;
    this.stockForm.patchValue({ quantity: 1, type: 'IN' });
    if (this.isEntryOnly) {
      this.stockForm.get('type')?.disable();
    } else {
      this.stockForm.get('type')?.enable();
    }
  }

  closeStock(): void {
    this.stockProductId = null;
  }

  async submitStock(): Promise<void> {
    if (!this.stockProductId || this.stockForm.invalid || this.submitting) return;
    const v = this.stockForm.getRawValue() as StockMovementCreateRequest;
    this.submitting = true;
    const type = this.isEntryOnly ? 'IN' : v.type;
    const body = { quantity: Math.abs(v.quantity), type };
    
    // Vérifier le stock disponible pour les sorties
    if (type === 'OUT' || type === 'SALE') {
      const availableStock = this.getAvailableStockForProduct(this.stockProductId);
      if (body.quantity > availableStock) {
        this.toast.error(`Stock insuffisant. Stock disponible: ${availableStock}`);
        this.submitting = false;
        return;
      }
    }
    
    this.businessOps.postStockMovement(this.stockProductId, body).subscribe({
      next: async (result) => {
        if (isPendingResponse(result)) {
          this.toast.success('Stock mis à jour localement. Synchronisation à la reconnexion.');
          await this.updateAvailableStocks();
        } else {
          this.toast.success('Stock mis à jour.');
        }
        await this.loadProducts();
        this.closeStock();
        this.submitting = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Stock insuffisant ou erreur.'));
        this.submitting = false;
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
