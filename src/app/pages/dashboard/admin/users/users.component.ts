import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent, MenuItem } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { ADMIN_MENU_ITEMS } from '../admin-menu.const';
import { AuthService, UserDto } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css'
})
export class UsersComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly router = inject(Router);
  readonly menuItems: MenuItem[] = ADMIN_MENU_ITEMS;

  sidebarOpen = false;
  loading = false;
  activeMenu = 'réinitialiser mdp';

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  userPreview: UserDto | null = null;

  loadUserByEmail(): void {
    const email = (this.form.value.email ?? '').trim();
    if (!email || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.userPreview = null;

    this.http.get<UserDto>(`${this.apiConfig.getUsersUrl()}?email=${encodeURIComponent(email)}`).subscribe({
      next: user => {
        this.userPreview = user;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.toast.error(extractErrorMessage(err, 'Utilisateur introuvable.'));
      }
    });
  }

  resetPassword(): void {
    const email = (this.form.value.email ?? '').trim();
    if (!email || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const user = this.auth.getUser();
    if (!user?.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.toast.error('Accès refusé. Réservé au SUPER_ADMIN.');
      return;
    }

    if (!confirm(`Réinitialiser le mot de passe de ${email} ? Un mot de passe temporaire sera envoyé par email.`)) {
      return;
    }

    this.loading = true;
    this.http.post<void>(this.apiConfig.getSuperAdminResetUserPasswordUrl(), { email }).subscribe({
      next: () => {
        this.loading = false;
        this.toast.success('Mot de passe réinitialisé. Email envoyé (si configuré).');
        this.loadUserByEmail();
      },
      error: err => {
        this.loading = false;
        this.toast.error(extractErrorMessage(err, 'Erreur lors de la réinitialisation.'));
      }
    });
  }

  getFieldError(fieldName: 'email'): string {
    const field = this.form.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';
    if (field.errors['required']) return 'Ce champ est requis';
    if (field.errors['email']) return 'Email invalide';
    return '';
  }
}

