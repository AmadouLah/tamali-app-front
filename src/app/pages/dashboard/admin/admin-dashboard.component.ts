import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../core/services/auth.service';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';

export interface ServiceRequestDto {
  id: string;
  email: string;
  objective: string;
  processed: boolean;
  createdAt: string;
}

interface KpiCard {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  progress: number;
  progressColor: string;
}

interface ChartData {
  day: string;
  revenue: number;
  expenses: number;
  profit: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiConfig = inject(ApiConfigService);

  user: UserDto | null = null;
  serviceRequests: ServiceRequestDto[] = [];
  loading = false;
  error: string | null = null;

  activeMenu: string = 'dashboard';
  searchQuery: string = '';
  period: string = 'weekly';

  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'grid', route: '/dashboard/admin' },
    { label: 'Ajouter Propriétaire', icon: 'user-plus', route: '/dashboard/admin/add-business-owner' },
    { label: 'Secteurs d\'activité', icon: 'briefcase', route: '/dashboard/admin/business-sectors' },
    { label: 'Mon Compte', icon: 'user', route: '/dashboard/admin/account' },
    { label: 'Performance', icon: 'chart-up' },
    { label: 'Statistics', icon: 'bar-chart' },
    { label: 'Analytics', icon: 'line-chart' },
    { label: 'Payments', icon: 'credit-card', badge: 3 },
    { label: 'Help', icon: 'help-circle' },
    { label: 'Settings', icon: 'settings' }
  ];

  kpiCards: KpiCard[] = [
    {
      title: 'Total Revenue',
      value: '$7,00,000',
      change: 6,
      changeLabel: 'From last week',
      progress: 25,
      progressColor: 'bg-blue-500'
    },
    {
      title: 'Total Expenses',
      value: '$5,00,000',
      change: -6,
      changeLabel: 'From last week',
      progress: 50,
      progressColor: 'bg-green-500'
    },
    {
      title: 'New Profit',
      value: '$2,00,000',
      change: -6,
      changeLabel: 'From last week',
      progress: 60,
      progressColor: 'bg-purple-500'
    },
    {
      title: 'Cash Balance',
      value: '$85,000',
      change: 6,
      changeLabel: 'From last week',
      progress: 35,
      progressColor: 'bg-yellow-500'
    }
  ];

  chartData: ChartData[] = [
    { day: 'Sun', revenue: 120000, expenses: 80000, profit: 40000 },
    { day: 'Mon', revenue: 150000, expenses: 90000, profit: 60000 },
    { day: 'Tue', revenue: 180000, expenses: 100000, profit: 80000 },
    { day: 'Wed', revenue: 140000, expenses: 85000, profit: 55000 },
    { day: 'Thu', revenue: 160000, expenses: 95000, profit: 65000 },
    { day: 'Fri', revenue: 200000, expenses: 110000, profit: 90000 },
    { day: 'Sat', revenue: 170000, expenses: 100000, profit: 70000 }
  ];

  paymentSuccessRate = 87;
  paymentSuccessCount = 550;
  paymentTotalCount = 650;
  paymentSuccessChange = 26;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.user || !this.user.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.loadServiceRequests();
    this.updateActiveMenuFromRoute();
  }

  private updateActiveMenuFromRoute(): void {
    const currentRoute = this.router.url;
    if (currentRoute.includes('add-business-owner')) {
      this.activeMenu = 'ajouter propriétaire';
    } else if (currentRoute.includes('business-sectors')) {
      this.activeMenu = 'secteurs d\'activité';
    } else if (currentRoute.includes('account')) {
      this.activeMenu = 'mon compte';
    } else if (currentRoute.includes('admin')) {
      this.activeMenu = 'dashboard';
    }
  }

  loadServiceRequests(): void {
    this.loading = true;
    this.error = null;
    this.http.get<ServiceRequestDto[]>(this.apiConfig.getServiceRequestsUrl()).subscribe({
      next: (requests) => {
        this.serviceRequests = requests;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des demandes.';
        this.loading = false;
      }
    });
  }

  markAsProcessed(id: string): void {
    this.http.patch<ServiceRequestDto>(`${this.apiConfig.getServiceRequestsUrl()}/${id}/process`, {}).subscribe({
      next: () => {
        this.loadServiceRequests();
      },
      error: () => {
        this.error = 'Erreur lors du traitement de la demande.';
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  getUserDisplayName(): string {
    if (!this.user) return '';
    return `${this.user.firstname} ${this.user.lastname}`.trim() || this.user.email;
  }

  getUserInitials(): string {
    if (!this.user) return '?';
    const first = this.user.firstname?.charAt(0).toUpperCase() || '';
    const last = this.user.lastname?.charAt(0).toUpperCase() || '';
    return (first + last) || this.user.email?.charAt(0).toUpperCase() || '?';
  }

  getMaxChartValue(): number {
    return Math.max(...this.chartData.map(d => d.revenue + d.expenses + d.profit));
  }

  getChartBarHeight(value: number): number {
    const max = this.getMaxChartValue();
    return (value / max) * 100;
  }
}
