import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { ADMIN_MENU_ITEMS } from '../admin-menu.const';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);

  user: UserDto | null = null;
  passwordForm!: FormGroup;
  loading = false;
  loadingPassword = false;
  showDisableConfirm = false;
  showDeleteConfirm = false;
  activeMenu: string = 'mon compte';
  sidebarOpen = false;

  menuItems: MenuItem[] = ADMIN_MENU_ITEMS;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.user || !this.user.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: (g) => g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { passwordMismatch: true } });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.loadingPassword || !this.user?.id) return;
    this.loadingPassword = true;
    this.authService.changePassword(
      this.user.id,
      this.passwordForm.value.currentPassword,
      this.passwordForm.value.newPassword
    ).subscribe({
      next: () => {
        this.toast.success('Mot de passe modifié.');
        this.passwordForm.reset();
        this.loadingPassword = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Erreur lors du changement de mot de passe.'));
        this.loadingPassword = false;
      }
    });
  }

  disableAccount(): void {
    if (!this.user) return;
    
    this.loading = true;

    this.http.patch<UserDto>(`${this.apiConfig.getUsersUrl()}/${this.user.id}/disable`, {}).subscribe({
      next: () => {
        this.toast.success('Votre compte a été désactivé avec succès.');
        this.loading = false;
        this.showDisableConfirm = false;
        setTimeout(() => {
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors de la désactivation du compte.');
        this.loading = false;
        this.showDisableConfirm = false;
      }
    });
  }

  deleteAccount(): void {
    if (!this.user) return;
    
    this.loading = true;

    this.http.delete(`${this.apiConfig.getUsersUrl()}/${this.user.id}`).subscribe({
      next: () => {
        this.toast.success('Votre compte a été supprimé avec succès.');
        this.loading = false;
        this.showDeleteConfirm = false;
        setTimeout(() => {
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Erreur lors de la suppression du compte.');
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
