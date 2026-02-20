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
  availableStocks: Map<string, number> = new Map();

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

  private async loadProducts(): Promise<void> {
    if (!this.businessId) return;
    this.businessOps.getProducts(this.businessId).subscribe({
      next: async (list) => {
        this.products = list;
        // Calculer les stocks disponibles pour tous les produits
        await this.updateAvailableStocks();
        this.loading = false;
        // Recharger les ventes locales maintenant que les produits sont disponibles
        await this.loadLocalSales();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private async updateAvailableStocks(): Promise<void> {
    this.availableStocks.clear();
    for (const product of this.products) {
      const available = await this.getAvailableStock(product.id, product.stockQuantity);
      this.availableStocks.set(product.id, available);
    }
  }

  getAvailableStockForProduct(productId: string): number {
    return this.availableStocks.get(productId) ?? 0;
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

  async getProductAvailableStock(productId: string): Promise<number> {
    const product = this.products.find(p => p.id === productId);
    if (!product) return 0;
    return await this.getAvailableStock(productId, product.stockQuantity);
  }

  async addToCart(product: ProductDto): Promise<void> {
    const availableStock = this.getAvailableStockForProduct(product.id);
    if (availableStock < 1) return;
    const existing = this.cart.find(l => l.productId === product.id);
    if (existing) {
      if (existing.quantity >= availableStock) return;
      existing.quantity += 1;
    } else {
      this.cart.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice,
        quantity: 1
      });
    }
    // Mettre à jour le stock disponible après ajout au panier
    await this.updateAvailableStocks();
  }

  async removeFromCart(index: number): Promise<void> {
    this.cart.splice(index, 1);
    await this.updateAvailableStocks();
  }

  async setCartQuantity(index: number, delta: number): Promise<void> {
    const line = this.cart[index];
    const product = this.products.find(p => p.id === line.productId);
    if (!product) return;
    const availableStock = this.getAvailableStockForProduct(product.id);
    const max = availableStock;
    const next = line.quantity + delta;
    if (next < 1) {
      this.cart.splice(index, 1);
      await this.updateAvailableStocks();
      return;
    }
    line.quantity = Math.min(next, max);
    await this.updateAvailableStocks();
  }

  private async getAvailableStock(productId: string, currentStock: number): Promise<number> {
    return await this.dbService.getAvailableStock(productId, currentStock);
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  }

  async validateSale(): Promise<void> {
    if (!this.businessId || !this.user?.id || this.cart.length === 0 || this.submitting) return;
    
    // Vérifier le stock disponible pour tous les produits du panier
    for (const line of this.cart) {
      const product = this.products.find(p => p.id === line.productId);
      if (!product) {
        this.error = `Produit ${line.productName} introuvable.`;
        return;
      }
      const availableStock = this.getAvailableStockForProduct(product.id);
      if (line.quantity > availableStock) {
        this.error = `Stock insuffisant pour ${line.productName}. Stock disponible: ${availableStock}`;
        return;
      }
    }
    
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
          // Enregistrer les mouvements de stock locaux
          const requestId = result.requestId;
          for (const line of body.items) {
            const movementId = `stock-${requestId}-${line.productId}`;
            await this.dbService.addLocalStockMovement({
              id: movementId,
              productId: line.productId,
              quantity: line.quantity,
              requestId
            });
          }
          // Mettre à jour les stocks disponibles
          await this.updateAvailableStocks();
          // Recharger les ventes locales immédiatement
          await this.loadLocalSales();
        } else {
          this.success = 'Vente enregistrée.';
        }
        await this.loadProducts();
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
