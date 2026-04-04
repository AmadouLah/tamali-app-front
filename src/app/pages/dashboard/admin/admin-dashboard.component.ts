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
  ServiceRequestDto,
  InstantNotificationScope,
  NotificationRoleType,
  NotificationUserOptionDto,
  InstantNotificationSendResultDto
} from '../../../core/models/super-admin-dashboard.types';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { ToastService } from '../../../core/services/toast.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { AnnouncementBannerComponent } from '../../../shared/components/announcement-banner/announcement-banner.component';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { ADMIN_MENU_ITEMS } from './admin-menu.const';

export type { ServiceRequestDto, BusinessSummaryDto };

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent, AnnouncementBannerComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly state = inject(AdminDashboardStateService);
  private readonly announcementService = inject(AnnouncementService);
  private readonly toast = inject(ToastService);

  user: UserDto | null = null;
  currentAnnouncement: { id: string; message: string } | null = null;
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

  menuItems: MenuItem[] = ADMIN_MENU_ITEMS;

  notifyMessage = '';
  notifyScope: InstantNotificationScope = 'ALL';
  notifyRole: NotificationRoleType = 'BUSINESS_OWNER';
  notificationUserOptions: NotificationUserOptionDto[] = [];
  notifyUserFilter = '';
  selectedNotifyUserIds: string[] = [];
  loadingNotifyUsers = false;
  sendingNotify = false;

  readonly notifyRoleOptions: NotificationRoleType[] = ['SUPER_ADMIN', 'BUSINESS_OWNER', 'BUSINESS_ASSOCIATE'];

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.user?.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.updateActiveMenuFromRoute();
    this.announcementService.getCurrent().subscribe(a => { this.currentAnnouncement = a; });
    if (this.state.hasData()) {
      this.dashboard = this.state.getDashboard();
      this.businesses = this.state.getBusinesses();
      this.serviceRequests = this.state.getServiceRequests();
    } else {
      this.loadAll();
    }
  }

  onAnnouncementClosed(): void {
    this.currentAnnouncement = null;
  }

  private updateActiveMenuFromRoute(): void {
    const currentRoute = this.router.url;
    if (currentRoute.includes('add-business-owner')) this.activeMenu = 'ajouter propriétaire';
    else if (currentRoute.includes('announcements')) this.activeMenu = 'annonces';
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

  get filteredNotificationUsers(): NotificationUserOptionDto[] {
    const q = this.notifyUserFilter.trim().toLowerCase();
    if (!q) return this.notificationUserOptions;
    return this.notificationUserOptions.filter(
      u =>
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.roleType.toLowerCase().includes(q)
    );
  }

  onNotifyScopeChange(): void {
    if (this.notifyScope === 'USERS' && this.notificationUserOptions.length === 0) {
      this.loadNotificationUserOptions();
    }
  }

  private loadNotificationUserOptions(): void {
    this.loadingNotifyUsers = true;
    this.http.get<NotificationUserOptionDto[]>(this.apiConfig.getSuperAdminNotificationUserOptionsUrl()).subscribe({
      next: list => {
        this.notificationUserOptions = list;
        this.loadingNotifyUsers = false;
      },
      error: err => {
        this.loadingNotifyUsers = false;
        this.toast.error(extractErrorMessage(err, 'Impossible de charger la liste des utilisateurs.'));
      }
    });
  }

  toggleNotifyUser(id: string): void {
    if (this.selectedNotifyUserIds.includes(id)) {
      this.selectedNotifyUserIds = this.selectedNotifyUserIds.filter(x => x !== id);
    } else {
      this.selectedNotifyUserIds = [...this.selectedNotifyUserIds, id];
    }
  }

  isNotifyUserSelected(id: string): boolean {
    return this.selectedNotifyUserIds.includes(id);
  }

  sendInstantNotification(): void {
    const message = this.notifyMessage.trim();
    if (!message) {
      this.toast.error('Saisissez un message.');
      return;
    }
    if (this.notifyScope === 'USERS' && this.selectedNotifyUserIds.length === 0) {
      this.toast.error('Sélectionnez au moins un utilisateur.');
      return;
    }

    const body: Record<string, unknown> = { message, scope: this.notifyScope };
    if (this.notifyScope === 'ROLE') body['roleType'] = this.notifyRole;
    if (this.notifyScope === 'USERS') body['userIds'] = this.selectedNotifyUserIds;

    this.sendingNotify = true;
    this.http.post<InstantNotificationSendResultDto>(this.apiConfig.getSuperAdminInstantNotificationUrl(), body).subscribe({
      next: res => {
        this.sendingNotify = false;
        this.toast.success(
          `Notification : ${res.sseRecipients} session(s) en direct (SSE) ; Web Push ${res.pushDelivered}/${res.pushTargets} livraison(s).`
        );
        this.notifyMessage = '';
      },
      error: err => {
        this.sendingNotify = false;
        this.toast.error(extractErrorMessage(err, 'Envoi impossible.'));
      }
    });
  }
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
