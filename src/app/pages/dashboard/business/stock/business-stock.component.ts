import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService, isPendingResponse } from '../../../../core/services/business-operations.service';
import {
  ProductDto,
  StockMovementCreateRequest,
  MovementType
} from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from '../business-menu.const';
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

  user: UserDto | null = null;
  businessId: string | null = null;
  products: ProductDto[] = [];
  stockForm!: FormGroup;
  stockProductId: string | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'stock';
  sidebarOpen = false;

  readonly menuItems = BUSINESS_OWNER_MENU_ITEMS;

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

  openStock(p: ProductDto): void {
    this.stockProductId = p.id;
    this.stockForm.patchValue({ quantity: 1, type: 'IN' });
    this.error = null;
  }

  closeStock(): void {
    this.stockProductId = null;
  }

  submitStock(): void {
    if (!this.stockProductId || this.stockForm.invalid || this.submitting) return;
    const v = this.stockForm.value as StockMovementCreateRequest;
    this.error = null;
    this.submitting = true;
    const body = { quantity: Math.abs(v.quantity), type: v.type };
    this.businessOps.postStockMovement(this.stockProductId, body).subscribe({
      next: (result) => {
        this.loadProducts();
        this.closeStock();
        this.success = isPendingResponse(result) ? 'Stock mis à jour. Synchronisation à la reconnexion.' : 'Stock mis à jour.';
        this.submitting = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Stock insuffisant ou erreur.';
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
