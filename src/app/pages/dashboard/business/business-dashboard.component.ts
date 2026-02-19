import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../core/services/auth.service';
import { BusinessOperationsService } from '../../../core/services/business-operations.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from './business-menu.const';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';

interface BusinessDto {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
}

interface SaleDto {
  id: string;
  totalAmount: number;
  taxAmount?: number;
  saleDate: string;
}

interface KpiCard {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  progress: number;
  progressColor: string;
}

@Component({
  selector: 'app-business-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent, UserAvatarComponent],
  templateUrl: './business-dashboard.component.html',
  styleUrl: './business-dashboard.component.css'
})
export class BusinessDashboardComponent implements OnInit {
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user: UserDto | null = null;
  business: BusinessDto | null = null;
  sales: SaleDto[] = [];
  loading = true;
  activeMenu = 'dashboard';
  searchQuery = '';
  sidebarOpen = false;

  menuItems = BUSINESS_OWNER_MENU_ITEMS;

  kpiCards: KpiCard[] = [
    { title: 'Revenus', value: '0 FCFA', change: 0, changeLabel: 'Cette semaine', progress: 0, progressColor: 'bg-blue-500' },
    { title: 'Ventes', value: '0', change: 0, changeLabel: 'Cette semaine', progress: 0, progressColor: 'bg-green-500' },
    { title: 'Panier moyen', value: '0 FCFA', change: 0, changeLabel: 'Cette semaine', progress: 0, progressColor: 'bg-purple-500' },
    { title: 'Objectif', value: '0%', change: 0, changeLabel: 'Ce mois', progress: 0, progressColor: 'bg-yellow-500' }
  ];

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
    this.loadBusiness();
  }

  private loadBusiness(): void {
    if (!this.user?.businessId) return;
    this.businessOps.getBusiness(this.user.businessId).subscribe({
      next: (b) => {
        this.business = b as unknown as BusinessDto;
        this.loadSales();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadSales(): void {
    if (!this.user?.businessId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.businessOps.getSales(this.user.businessId, 0, 10).subscribe({
      next: (sales) => {
        this.sales = sales;
        this.computeKpis();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private computeKpis(): void {
    const totalRevenue = this.sales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
    const count = this.sales.length;
    const avgBasket = count > 0 ? totalRevenue / count : 0;
    this.kpiCards = [
      { title: 'Revenus', value: `${totalRevenue.toLocaleString('fr-FR')} FCFA`, change: 0, changeLabel: 'Total', progress: Math.min(100, count * 10), progressColor: 'bg-blue-500' },
      { title: 'Ventes', value: String(count), change: 0, changeLabel: 'Récentes', progress: Math.min(100, count * 20), progressColor: 'bg-green-500' },
      { title: 'Panier moyen', value: `${avgBasket.toLocaleString('fr-FR')} FCFA`, change: 0, changeLabel: 'Sur les ventes affichées', progress: 50, progressColor: 'bg-purple-500' },
      { title: 'Objectif', value: '0%', change: 0, changeLabel: 'Ce mois', progress: 0, progressColor: 'bg-yellow-500' }
    ];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatMoney(amount: number): string {
    return `${(amount ?? 0).toLocaleString('fr-FR')} FCFA`;
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }
}
