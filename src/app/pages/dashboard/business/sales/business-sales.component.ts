import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import {
  ProductDto,
  SaleDto,
  SaleCreateRequest,
  PaymentMethod,
  PAYMENT_METHOD_LABELS
} from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

interface CartLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

@Component({
  selector: 'app-business-sales',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-sales.component.html',
  styleUrl: './business-sales.component.css'
})
export class BusinessSalesComponent implements OnInit {
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user: UserDto | null = null;
  businessId: string | null = null;
  products: ProductDto[] = [];
  sales: SaleDto[] = [];
  cart: CartLine[] = [];
  paymentMethod: PaymentMethod = 'CASH';
  productSearch = '';
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'ventes';
  sidebarOpen = false;

  readonly menuItems = BUSINESS_OWNER_MENU_ITEMS;
  readonly paymentLabels = PAYMENT_METHOD_LABELS;
  readonly paymentOptions: PaymentMethod[] = ['CASH', 'ORANGE_MONEY', 'CARD'];

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
    this.businessId = this.user.businessId!;
    this.loadProducts();
    this.loadSales();
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

  loadSales(): void {
    if (!this.businessId) return;
    this.businessOps.getSales(this.businessId, 0, 20).subscribe({
      next: (list) => (this.sales = list),
      error: () => {}
    });
  }

  get filteredProducts(): ProductDto[] {
    const q = this.productSearch.trim().toLowerCase();
    if (!q) return this.products;
    return this.products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.reference ?? '').toLowerCase().includes(q)
    );
  }

  addToCart(product: ProductDto): void {
    if (product.stockQuantity < 1) return;
    const existing = this.cart.find(l => l.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stockQuantity) return;
      existing.quantity += 1;
    } else {
      this.cart.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice,
        quantity: 1
      });
    }
  }

  removeFromCart(index: number): void {
    this.cart.splice(index, 1);
  }

  setCartQuantity(index: number, delta: number): void {
    const line = this.cart[index];
    const product = this.products.find(p => p.id === line.productId);
    const max = product?.stockQuantity ?? line.quantity;
    const next = line.quantity + delta;
    if (next < 1) {
      this.cart.splice(index, 1);
      return;
    }
    line.quantity = Math.min(next, max);
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  }

  validateSale(): void {
    if (!this.businessId || !this.user?.id || this.cart.length === 0 || this.submitting) return;
    this.error = null;
    this.success = null;
    this.submitting = true;
    const body: SaleCreateRequest = {
      cashierId: this.user.id,
      items: this.cart.map(l => ({ productId: l.productId, quantity: l.quantity })),
      method: this.paymentMethod
    };
    this.businessOps.createSale(this.businessId, body).subscribe({
      next: (result) => {
        this.cart = [];
        this.success = isPendingResponse(result)
          ? 'Vente enregistrée. Elle sera synchronisée à la reconnexion.'
          : 'Vente enregistrée.';
        this.loadProducts();
        this.loadSales();
        this.submitting = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Impossible d\'enregistrer la vente (vérifiez le stock).';
        this.submitting = false;
      }
    });
  }

  formatMoney(amount: number): string {
    return `${(amount ?? 0).toLocaleString('fr-FR')} FCFA`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }
}
