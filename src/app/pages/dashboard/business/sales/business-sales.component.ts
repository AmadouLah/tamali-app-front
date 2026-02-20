import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import { IndexedDbService } from '../../../../core/services/indexed-db.service';
import {
  ProductDto,
  SaleDto,
  SaleCreateRequest,
  PaymentMethod,
  PAYMENT_METHOD_LABELS
} from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from '../business-menu.const';
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
  private readonly dbService = inject(IndexedDbService);

  user: UserDto | null = null;
  businessId: string | null = null;
  products: ProductDto[] = [];
  sales: SaleDto[] = [];
  localSales: SaleDto[] = [];
  cart: CartLine[] = [];
  paymentMethod: PaymentMethod = 'CASH';
  productSearch = '';
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'ventes';
  sidebarOpen = false;

  menuItems = getBusinessMenuItems(null);
  readonly paymentLabels = PAYMENT_METHOD_LABELS;
  readonly paymentOptions: PaymentMethod[] = ['CASH', 'ORANGE_MONEY', 'CARD'];

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.menuItems = getBusinessMenuItems(this.user);
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      if (this.user && this.authService.shouldRedirectToSetup(this.user)) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    this.businessId = this.user?.businessId ?? null;
    this.loadProducts();
    this.loadSales();
  }

  private loadProducts(): void {
    if (!this.businessId) return;
    this.businessOps.getProducts(this.businessId).subscribe({
      next: async (list) => {
        this.products = list;
        this.loading = false;
        // Recharger les ventes locales maintenant que les produits sont disponibles
        await this.loadLocalSales();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  async loadSales(): Promise<void> {
    if (!this.businessId) return;
    
    // Charger les ventes depuis le serveur
    this.businessOps.getSales(this.businessId, 0, 20).subscribe({
      next: (list) => {
        this.sales = list;
        this.loadLocalSales();
      },
      error: () => {
        this.loadLocalSales();
      }
    });
  }

  private async loadLocalSales(): Promise<void> {
    if (!this.businessId) return;
    
    try {
      const localSalesData = await this.dbService.getLocalSales(this.businessId);
      this.localSales = localSalesData
        .filter(ls => !ls.synced)
        .map(ls => {
          const sale = ls.sale as any;
          // Enrichir les items avec les informations des produits
          const enrichedItems = sale.items?.map((item: any) => {
            const product = this.products.find(p => p.id === item.productId);
            return {
              ...item,
              productName: product?.name || 'Produit inconnu',
              price: product?.unitPrice || 0
            };
          }) || [];
          
          // Calculer le totalAmount basé sur les produits
          const totalAmount = enrichedItems.reduce((sum: number, item: any) => {
            return sum + (item.price * item.quantity);
          }, 0);
          
          return {
            ...sale,
            items: enrichedItems,
            totalAmount,
            id: ls.id,
            isLocal: true
          } as SaleDto & { isLocal?: boolean };
        });
      
      // Nettoyer les ventes synchronisées anciennes (plus de 24h)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      for (const ls of localSalesData) {
        if (ls.synced && ls.timestamp < oneDayAgo) {
          await this.dbService.removeLocalSale(ls.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des ventes locales:', error);
    }
  }

  get allSales(): (SaleDto & { isLocal?: boolean })[] {
    const combined = [...this.sales, ...this.localSales];
    return combined.sort((a, b) => 
      new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );
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
      next: async (result) => {
        this.cart = [];
        if (isPendingResponse(result)) {
          this.success = 'Vente enregistrée localement. Elle sera synchronisée à la reconnexion.';
          // Recharger les ventes locales immédiatement
          await this.loadLocalSales();
        } else {
          this.success = 'Vente enregistrée.';
        }
        this.loadProducts();
        await this.loadSales();
        this.submitting = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Impossible d\'enregistrer la vente (vérifiez le stock).';
        this.submitting = false;
      }
    });
  }

  generatingReceiptId: string | null = null;

  generateReceipt(sale: SaleDto & { isLocal?: boolean }): void {
    if (this.generatingReceiptId) return;
    
    // Ne pas générer de reçu pour les ventes locales non synchronisées
    if (sale.isLocal) {
      this.error = 'Impossible de générer un reçu pour une vente non synchronisée.';
      return;
    }
    
    this.generatingReceiptId = sale.id;
    this.businessOps.generateReceipt(sale.id).subscribe({
      next: (res) => {
        if (res?.receiptPdfUrl) window.open(res.receiptPdfUrl, '_blank');
        this.generatingReceiptId = null;
      },
      error: () => {
        this.generatingReceiptId = null;
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
