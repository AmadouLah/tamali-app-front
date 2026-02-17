import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiConfig = inject(ApiConfigService);

  user: UserDto | null = null;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  showDisableConfirm = false;
  showDeleteConfirm = false;
  activeMenu: string = 'mon compte';
  sidebarOpen = false;

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

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.user || !this.user.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
  }

  disableAccount(): void {
    if (!this.user) return;
    
    this.loading = true;
    this.error = null;
    this.success = null;

    this.http.patch<UserDto>(`${this.apiConfig.getUsersUrl()}/${this.user.id}/disable`, {}).subscribe({
      next: () => {
        this.success = 'Votre compte a été désactivé avec succès.';
        this.loading = false;
        this.showDisableConfirm = false;
        setTimeout(() => {
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la désactivation du compte.';
        this.loading = false;
        this.showDisableConfirm = false;
      }
    });
  }

  deleteAccount(): void {
    if (!this.user) return;
    
    this.loading = true;
    this.error = null;
    this.success = null;

    this.http.delete(`${this.apiConfig.getUsersUrl()}/${this.user.id}`).subscribe({
      next: () => {
        this.success = 'Votre compte a été supprimé avec succès.';
        this.loading = false;
        this.showDeleteConfirm = false;
        setTimeout(() => {
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la suppression du compte.';
        this.loading = false;
        this.showDeleteConfirm = false;
      }
    });
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
}
