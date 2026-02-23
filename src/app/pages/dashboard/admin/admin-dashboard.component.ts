import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../core/services/auth.service';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { AdminDashboardStateService } from '../../../core/services/admin-dashboard-state.service';
import type {
  SuperAdminDashboard,
  BusinessSummaryDto,
  ServiceRequestDto
} from '../../../core/models/super-admin-dashboard.types';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';

export type { ServiceRequestDto, BusinessSummaryDto };

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
  private readonly state = inject(AdminDashboardStateService);

  user: UserDto | null = null;
  dashboard: SuperAdminDashboard | null = null;
  businesses: BusinessSummaryDto[] = [];
  serviceRequests: ServiceRequestDto[] = [];
  loading = false;
  loadingBusinesses = false;
  refreshing = false;
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
    this.updateActiveMenuFromRoute();
    if (this.state.hasData()) {
      this.dashboard = this.state.getDashboard();
      this.businesses = this.state.getBusinesses();
      this.serviceRequests = this.state.getServiceRequests();
    } else {
      this.loadAll();
    }
  }

  private updateActiveMenuFromRoute(): void {
    const currentRoute = this.router.url;
    if (currentRoute.includes('add-business-owner')) this.activeMenu = 'ajouter propriétaire';
    else if (currentRoute.includes('business-sectors')) this.activeMenu = 'secteurs d\'activité';
    else if (currentRoute.includes('account')) this.activeMenu = 'mon compte';
    else if (currentRoute.includes('admin')) this.activeMenu = 'dashboard';
  }

  /** Actualise toutes les données (bouton Actualiser). */
  refreshData(): void {
    this.refreshing = true;
    this.error = null;
    this.loadAll(true);
  }

  private loadAll(fromRefresh = false): void {
    if (!fromRefresh) this.loading = true;
    this.loadingBusinesses = true;
    this.error = null;
    let pending = 3;

    const onOneDone = (): void => {
      pending--;
      if (pending === 0) this.refreshing = false;
    };

    this.http.get<SuperAdminDashboard>(this.apiConfig.getSuperAdminDashboardUrl()).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.state.setDashboard(data);
        this.loading = false;
        onOneDone();
      },
      error: () => {
        this.error = 'Erreur lors du chargement du tableau de bord.';
        this.loading = false;
        onOneDone();
      }
    });

    this.http.get<BusinessSummaryDto[]>(this.apiConfig.getSuperAdminBusinessesUrl()).subscribe({
      next: (list) => {
        this.businesses = list;
        this.state.setBusinesses(list);
        this.loadingBusinesses = false;
        onOneDone();
      },
      error: () => {
        this.loadingBusinesses = false;
        onOneDone();
      }
    });

    this.http.get<ServiceRequestDto[]>(this.apiConfig.getServiceRequestsUrl()).subscribe({
      next: (requests) => {
        this.serviceRequests = requests;
        this.state.setServiceRequests(requests);
        onOneDone();
      },
      error: () => onOneDone()
    });
  }

  loadServiceRequests(): void {
    this.http.get<ServiceRequestDto[]>(this.apiConfig.getServiceRequestsUrl()).subscribe({
      next: (requests) => {
        this.serviceRequests = requests;
        this.state.setServiceRequests(requests);
      }
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
      next: () => {
        this.businesses = this.businesses.filter(x => x.id !== b.id);
        this.state.setBusinesses(this.businesses);
      },
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
