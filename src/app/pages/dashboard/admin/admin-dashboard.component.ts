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

interface SuperAdminPlatformStats {
  totalBusinesses: number;
  totalUsers: number;
  totalSalesCount: number;
  totalTransactionVolume: number;
  activeBusinessesToday: number;
}

interface BusinessActivitySummary {
  id: string;
  name: string;
  saleCountOrDaysSinceLastSale: number;
}

interface SuperAdminRecentActivity {
  newBusinessesCount: number;
  newUsersCount: number;
  mostActiveBusinesses: BusinessActivitySummary[];
  inactiveBusinesses: BusinessActivitySummary[];
}

interface SalesPerDay {
  date: string;
  count: number;
}

interface SuperAdminUsageStats {
  salesPerDay: SalesPerDay[];
  peakActivityLabel: string;
  usageRatePercent: number;
}

interface SuperAdminSystemMonitoring {
  serverStatus: string;
  criticalErrors: string[];
  syncFailures: string[];
  emailOrWhatsAppFailures: string[];
}

interface SuperAdminDashboard {
  platformStats: SuperAdminPlatformStats;
  recentActivity: SuperAdminRecentActivity;
  usageStats: SuperAdminUsageStats;
  systemMonitoring: SuperAdminSystemMonitoring;
}

export interface BusinessSummaryDto {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  userCount: number;
  createdAt: string;
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
  dashboard: SuperAdminDashboard | null = null;
  businesses: BusinessSummaryDto[] = [];
  serviceRequests: ServiceRequestDto[] = [];
  loading = false;
  loadingBusinesses = false;
  error: string | null = null;

  activeMenu = 'dashboard';
  searchQuery = '';
  sidebarOpen = false;

  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'grid', route: '/dashboard/admin' },
    { label: 'Ajouter Propriétaire', icon: 'user-plus', route: '/dashboard/admin/add-business-owner' },
    { label: 'Secteurs d\'activité', icon: 'briefcase', route: '/dashboard/admin/business-sectors' },
    { label: 'Mon Compte', icon: 'user', route: '/dashboard/admin/account' }
  ];

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.user?.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.loadDashboard();
    this.loadBusinesses();
    this.loadServiceRequests();
    this.updateActiveMenuFromRoute();
  }

  private updateActiveMenuFromRoute(): void {
    const currentRoute = this.router.url;
    if (currentRoute.includes('add-business-owner')) this.activeMenu = 'ajouter propriétaire';
    else if (currentRoute.includes('business-sectors')) this.activeMenu = 'secteurs d\'activité';
    else if (currentRoute.includes('account')) this.activeMenu = 'mon compte';
    else if (currentRoute.includes('admin')) this.activeMenu = 'dashboard';
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;
    this.http.get<SuperAdminDashboard>(this.apiConfig.getSuperAdminDashboardUrl()).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement du tableau de bord.';
        this.loading = false;
      }
    });
  }

  loadBusinesses(): void {
    this.loadingBusinesses = true;
    this.http.get<BusinessSummaryDto[]>(this.apiConfig.getSuperAdminBusinessesUrl()).subscribe({
      next: (list) => {
        this.businesses = list;
        this.loadingBusinesses = false;
      },
      error: () => { this.loadingBusinesses = false; }
    });
  }

  loadServiceRequests(): void {
    this.http.get<ServiceRequestDto[]>(this.apiConfig.getServiceRequestsUrl()).subscribe({
      next: (requests) => this.serviceRequests = requests,
      error: () => { /* déjà géré par loadDashboard si besoin */ }
    });
  }

  setBusinessActive(b: BusinessSummaryDto, active: boolean): void {
    this.http.patch(this.apiConfig.getBusinessesUrl() + '/' + b.id, { active }).subscribe({
      next: () => { b.active = active; },
      error: () => this.error = 'Erreur lors de la mise à jour.'
    });
  }

  deleteBusiness(b: BusinessSummaryDto): void {
    if (!confirm(`Supprimer l\'entreprise « ${b.name} » ?`)) return;
    this.http.delete(this.apiConfig.getBusinessesUrl() + '/' + b.id).subscribe({
      next: () => { this.businesses = this.businesses.filter(x => x.id !== b.id); },
      error: () => this.error = 'Erreur lors de la suppression.'
    });
  }

  markAsProcessed(id: string): void {
    this.http.patch<ServiceRequestDto>(`${this.apiConfig.getServiceRequestsUrl()}/${id}/process`, {}).subscribe({
      next: () => this.loadServiceRequests(),
      error: () => this.error = 'Erreur lors du traitement de la demande.'
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatVolume(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  }

  formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  setActiveMenu(menu: string): void { this.activeMenu = menu; }
  getUserDisplayName(): string {
    if (!this.user) return '';
    return (`${this.user.firstname ?? ''} ${this.user.lastname ?? ''}`.trim() || this.user.email) ?? '';
  }
  getUserInitials(): string {
    if (!this.user) return '?';
    const first = this.user.firstname?.charAt(0).toUpperCase() ?? '';
    const last = this.user.lastname?.charAt(0).toUpperCase() ?? '';
    return (first + last) || (this.user.email?.charAt(0).toUpperCase() ?? '?');
  }

  getMaxSalesCount(): number {
    const list = this.dashboard?.usageStats?.salesPerDay ?? [];
    return list.length ? Math.max(...list.map(d => d.count)) : 0;
  }
  getBarHeight(count: number): number {
    const max = this.getMaxSalesCount();
    return max > 0 ? (count / max) * 100 : 0;
  }
}
