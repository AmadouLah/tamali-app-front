import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserDto } from '../../../core/services/auth.service';
import { BusinessOperationsService } from '../../../core/services/business-operations.service';
import { BusinessDashboardCacheService } from '../../../core/services/business-dashboard-cache.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from './business-menu.const';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import type { SaleDto, SaleItemDto, ProductDto } from '../../../core/models/product.model';

interface BusinessDto {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  commerceRegisterNumber?: string;
  logoUrl?: string;
}

interface KpiCard {
  title: string;
  value: string;
  changeLabel: string;
  progress: number;
  progressColor: string;
}

interface ChartBarPoint {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface PieSlice {
  label: string;
  value: number;
  color: string;
  percent: number;
}

@Component({
  selector: 'app-business-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, GlassCardComponent, AdminSidebarComponent, UserAvatarComponent],
  templateUrl: './business-dashboard.component.html',
  styleUrl: './business-dashboard.component.css'
})
export class BusinessDashboardComponent implements OnInit {
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dashboardCache = inject(BusinessDashboardCacheService);

  user: UserDto | null = null;
  business: BusinessDto | null = null;
  sales: SaleDto[] = [];
  products: ProductDto[] = [];
  loading = true;
  refreshing = false;
  activeMenu = 'dashboard';
  sidebarOpen = false;

  menuItems = getBusinessMenuItems(null);

  totalExpenses = 0;
  totalRevenue = 0;
  totalProfit = 0;
  stockValue = 0;
  revenueThisWeek = 0;
  revenueThisMonth = 0;
  revenueThisYear = 0;

  kpiCards: KpiCard[] = [];
  barChartData: ChartBarPoint[] = [];
  lineChartData: ChartBarPoint[] = [];
  pieChartData: PieSlice[] = [];
  chartPeriod: 'week' | 'month' | 'year' = 'week';

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
    if (!this.authService.isBusinessOwner(this.user)) {
      this.router.navigate(['/dashboard/business/sales']);
      return;
    }
    this.loadBusiness();
  }

  private loadBusiness(): void {
    if (!this.user?.businessId) return;
    const cached = this.dashboardCache.get(this.user.businessId);
    if (cached) {
      this.applyData(cached);
      this.loading = false;
      return;
    }
    this.fetchAndApply();
  }

  /** Charge les données fraîches depuis l'API et met à jour le cache. */
  refresh(): void {
    if (!this.user?.businessId) return;
    this.refreshing = true;
    this.fetchAndApply(true);
  }

  private fetchAndApply(skipLoadingState = false): void {
    if (!this.user?.businessId) {
      this.loading = false;
      this.refreshing = false;
      return;
    }
    if (!skipLoadingState) this.loading = true;
    forkJoin({
      business: this.businessOps.getBusiness(this.user.businessId),
      sales: this.businessOps.getSales(this.user.businessId, 0, 500),
      products: this.businessOps.getProducts(this.user.businessId)
    }).subscribe({
      next: ({ business, sales, products }) => {
        const data = { sales, products, business };
        this.dashboardCache.set(this.user!.businessId!, data);
        this.applyData(data);
      },
      error: () => {},
      complete: () => {
        this.loading = false;
        this.refreshing = false;
      }
    });
  }

  private applyData(data: { sales: SaleDto[]; products: ProductDto[]; business: Record<string, unknown> | null }): void {
    this.business = data.business as unknown as BusinessDto;
    this.sales = data.sales;
    this.products = data.products;
    this.computeAllStats();
  }

  private computeExpenses(sales: SaleDto[]): number {
    return sales.reduce((sum, s) => {
      const itemExpenses = (s.items ?? []).reduce((itemSum: number, item: SaleItemDto) => {
        const pp = Number(item.purchasePrice ?? 0);
        return itemSum + pp * (item.quantity ?? 0);
      }, 0);
      return sum + itemExpenses;
    }, 0);
  }

  private computeAllStats(): void {
    const revenue = this.sales.reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);
    const expenses = this.computeExpenses(this.sales);
    const profit = revenue - expenses;
    const stockVal = this.products.reduce(
      (s, p) => s + (Number(p.purchasePrice ?? 0) * (p.stockQuantity ?? 0)),
      0
    );

    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const revWeek = this.sales
      .filter(s => new Date(s.saleDate) >= weekStart)
      .reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);
    const revMonth = this.sales
      .filter(s => new Date(s.saleDate) >= monthStart)
      .reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);
    const revYear = this.sales
      .filter(s => new Date(s.saleDate) >= yearStart)
      .reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);

    this.totalRevenue = revenue;
    this.totalExpenses = expenses;
    this.totalProfit = profit;
    this.stockValue = stockVal;
    this.revenueThisWeek = revWeek;
    this.revenueThisMonth = revMonth;
    this.revenueThisYear = revYear;

    this.buildKpiCards(revWeek, revMonth);
    this.buildBarChartData();
    this.buildLineChartData();
    this.buildPieChartData();
  }

  private getWeekStart(d: Date): Date {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
  }

  private buildKpiCards(revWeek: number, revMonth: number): void {
    const maxKpi = Math.max(this.totalRevenue, this.totalExpenses, this.stockValue, 1);
    const progress = (v: number) => Math.min(100, Math.round((v / maxKpi) * 100));

    this.kpiCards = [
      {
        title: 'Dépenses',
        value: `${this.totalExpenses.toLocaleString('fr-FR')} FCFA`,
        changeLabel: 'Coût d\'achat total',
        progress: progress(this.totalExpenses),
        progressColor: 'bg-amber-500'
      },
      {
        title: 'Bénéfice',
        value: `${this.totalProfit.toLocaleString('fr-FR')} FCFA`,
        changeLabel: this.totalRevenue > 0 ? `${Math.round((this.totalProfit / this.totalRevenue) * 100)}% de marge` : 'Sur les ventes',
        progress: progress(Math.max(0, this.totalProfit)),
        progressColor: 'bg-emerald-500'
      },
      {
        title: 'Valeur du stock',
        value: `${this.stockValue.toLocaleString('fr-FR')} FCFA`,
        changeLabel: `${this.products.length} produits`,
        progress: progress(this.stockValue),
        progressColor: 'bg-violet-500'
      },
      {
        title: 'Chiffre d\'affaires',
        value: `${this.totalRevenue.toLocaleString('fr-FR')} FCFA`,
        changeLabel: `Semaine: ${revWeek.toLocaleString('fr-FR')} | Mois: ${revMonth.toLocaleString('fr-FR')}`,
        progress: progress(this.totalRevenue),
        progressColor: 'bg-blue-500'
      }
    ];
  }

  private buildBarChartData(): void {
    const grouped = this.groupByPeriod();
    this.barChartData = grouped.map(g => ({
      label: g.label,
      revenue: g.revenue,
      expenses: this.computeExpenses(g.sales),
      profit: g.revenue - this.computeExpenses(g.sales)
    }));
  }

  private buildLineChartData(): void {
    this.lineChartData = [...this.barChartData];
  }

  private buildPieChartData(): void {
    const base = this.totalRevenue || 1;
    if (this.totalRevenue <= 0) {
      this.pieChartData = [
        { label: 'Dépenses', value: 0, color: '#f59e0b', percent: 50 },
        { label: 'Bénéfice', value: 0, color: '#10b981', percent: 50 }
      ];
      return;
    }
    const expPct = (this.totalExpenses / base) * 100;
    const profitPct = (Math.max(0, this.totalProfit) / base) * 100;
    this.pieChartData = [
      { label: 'Dépenses (coût)', value: this.totalExpenses, color: '#f59e0b', percent: expPct },
      { label: 'Bénéfice', value: Math.max(0, this.totalProfit), color: '#10b981', percent: profitPct }
    ];
  }

  private groupByPeriod(): { label: string; revenue: number; sales: SaleDto[] }[] {
    const now = new Date();
    const result: { label: string; revenue: number; sales: SaleDto[] }[] = [];

    if (this.chartPeriod === 'week') {
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
        const daySales = this.sales.filter(
          s => {
            const sd = new Date(s.saleDate);
            const sdDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, 0, 0, 0);
            return sdDay >= d && sdDay < next;
          }
        );
        const rev = daySales.reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);
        result.push({ label: days[d.getDay()], revenue: rev, sales: daySales });
      }
    } else if (this.chartPeriod === 'month') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const monthSales = this.sales.filter(s => {
          const sd = new Date(s.saleDate);
          return sd >= d && sd < next;
        });
        const rev = monthSales.reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        result.push({ label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, revenue: rev, sales: monthSales });
      }
    } else {
      const currentYear = now.getFullYear();
      for (let y = currentYear - 4; y <= currentYear; y++) {
        const yearStart = new Date(y, 0, 1);
        const yearEnd = new Date(y + 1, 0, 1);
        const yearSales = this.sales.filter(s => {
          const sd = new Date(s.saleDate);
          return sd >= yearStart && sd < yearEnd;
        });
        const rev = yearSales.reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);
        result.push({ label: String(y), revenue: rev, sales: yearSales });
      }
    }
    return result;
  }

  setChartPeriod(p: 'week' | 'month' | 'year'): void {
    this.chartPeriod = p;
    this.buildBarChartData();
    this.buildLineChartData();
  }

  getBarMaxValue(): number {
    if (this.barChartData.length === 0) return 1;
    return Math.max(
      ...this.barChartData.flatMap(d => [d.revenue, d.expenses, d.profit]),
      1
    );
  }

  getBarHeight(value: number): number {
    const max = this.getBarMaxValue();
    return max > 0 ? (value / max) * 100 : 0;
  }

  /** Indique si le graphique bar a des données à afficher */
  get hasBarChartData(): boolean {
    return this.barChartData.some(d => d.revenue > 0 || d.expenses > 0 || d.profit > 0);
  }

  getLinePath(): string {
    const data = this.lineChartData;
    if (data.length === 0) return '';
    const max = Math.max(...data.map(d => d.revenue), 1);
    const w = 100 / (data.length || 1);
    const points = data.map((d, i) => {
      const x = (i + 0.5) * w;
      const y = 100 - (d.revenue / max) * 90;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }

  getPiePath(index: number): string {
    const total = this.pieChartData.reduce((s, x) => s + x.percent, 0);
    if (total <= 0 || index >= this.pieChartData.length) return '';
    let startAngle = 0;
    for (let i = 0; i < index; i++) {
      startAngle += (this.pieChartData[i].percent / 100) * 360;
    }
    const sweep = (this.pieChartData[index].percent / 100) * 360;
    if (sweep <= 0) return '';
    const r = 45;
    const cx = 50;
    const cy = 50;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(startAngle - 90));
    const y1 = cy + r * Math.sin(rad(startAngle - 90));
    const x2 = cx + r * Math.cos(rad(startAngle + sweep - 90));
    const y2 = cy + r * Math.sin(rad(startAngle + sweep - 90));
    const large = sweep > 180 ? 1 : 0;
    return `M 50 50 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
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

  generateReceipt(sale: SaleDto): void {
    if (!this.user?.businessId) return;
    firstValueFrom(this.businessOps.getBusiness(this.user.businessId)).then(business => {
      this.router.navigate(['/dashboard/business/sales/receipt'], {
        state: { sale, business: business ?? {}, cashierName: this.getDisplayName() }
      });
    }).catch(() => {
      this.router.navigate(['/dashboard/business/sales/receipt'], {
        state: { sale, business: this.business ?? {}, cashierName: this.getDisplayName() }
      });
    });
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  get recentSales(): SaleDto[] {
    return this.sales.slice(0, 10);
  }
}
