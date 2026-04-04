import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';
import type {
  InstantNotificationScope,
  NotificationRoleType,
  NotificationUserOptionDto,
  InstantNotificationSendResultDto
} from '../../../../core/models/super-admin-dashboard.types';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { ADMIN_MENU_ITEMS } from '../admin-menu.const';

@Component({
  selector: 'app-instant-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './instant-notifications.component.html',
  styleUrl: './instant-notifications.component.css'
})
export class InstantNotificationsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);

  readonly menuItems = ADMIN_MENU_ITEMS;
  activeMenu = 'notifications instantanées';
  sidebarOpen = false;

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
    const user = this.auth.getUser();
    if (!user?.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
    }
  }

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
}
