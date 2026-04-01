import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';
import { ServiceRequestClientService } from '../../../../core/services/service-request-client.service';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-business-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    GlassCardComponent,
    AdminSidebarComponent,
    UserAvatarComponent
  ],
  templateUrl: './business-profile.component.html',
  styleUrl: './business-profile.component.css'
})
export class BusinessProfileComponent implements OnInit, OnDestroy {
  private static readonly RESET_REQUEST_COOLDOWN_MS = 5 * 60 * 1000;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly serviceRequests = inject(ServiceRequestClientService);

  user: UserDto | null = null;
  form!: FormGroup;
  identityForm!: FormGroup;
  loading = false;
  loadingIdentity = false;
  requestingReset = false;
  resetCooldownRemainingMs = 0;
  private cooldownTimer?: number;
  activeMenu = 'profil';
  sidebarOpen = false;

  menuItems = getBusinessMenuItems(null);

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      this.router.navigate(this.user && this.authService.shouldRedirectToSetup(this.user)
        ? ['/business/setup'] : ['/auth/login'], this.user ? { queryParams: { userId: this.user.id } } : {});
      return;
    }
    this.menuItems = getBusinessMenuItems(this.user);
    this.form = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: (g) => g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { passwordMismatch: true } });

    this.identityForm = this.fb.group({
      firstname: [(this.user?.firstname ?? '').trim()],
      lastname: [(this.user?.lastname ?? '').trim()]
    });

    this.syncResetCooldownFromStorage();
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      window.clearInterval(this.cooldownTimer);
      this.cooldownTimer = undefined;
    }
  }

  saveIdentity(): void {
    if (this.loadingIdentity || !this.user) return;
    const first = (this.identityForm.value.firstname ?? '').trim();
    const last = (this.identityForm.value.lastname ?? '').trim();
    this.loadingIdentity = true;
    this.authService.updateUserProfile(first, last).subscribe({
      next: () => {
        this.user = this.authService.getUser();
        this.toast.success('Profil mis à jour.');
        this.loadingIdentity = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Erreur lors de la mise à jour.'));
        this.loadingIdentity = false;
      }
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading || !this.user?.id) return;
    this.loading = true;
    this.authService.changePassword(
      this.user.id,
      this.form.value.currentPassword,
      this.form.value.newPassword
    ).subscribe({
      next: () => {
        this.toast.success('Mot de passe modifié.');
        this.form.reset();
        this.loading = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Erreur lors du changement.'));
        this.loading = false;
      }
    });
  }

  requestPasswordReset(): void {
    if (this.requestingReset || this.resetCooldownRemainingMs > 0 || !this.user?.email) return;
    if (!confirm("Envoyer une demande de réinitialisation de mot de passe au support Tamali ?")) return;

    this.requestingReset = true;
    const email = this.user.email;
    const objective = `Demande de réinitialisation du mot de passe pour le compte: ${email}`;

    this.serviceRequests.create({ email, objective }).subscribe({
      next: () => {
        this.toast.success("Demande envoyée. Le support vous contactera / réinitialisera votre accès.");
        this.requestingReset = false;
        this.startResetCooldown(email);
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, "Erreur lors de l'envoi de la demande."));
        this.requestingReset = false;
      }
    });
  }

  getResetCooldownLabel(): string {
    const totalSeconds = Math.ceil(this.resetCooldownRemainingMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  private syncResetCooldownFromStorage(): void {
    const email = this.user?.email;
    if (!email) return;

    const lastAtMs = this.getLastResetRequestAtMs(email);
    if (!lastAtMs) return;

    const remaining = (lastAtMs + BusinessProfileComponent.RESET_REQUEST_COOLDOWN_MS) - Date.now();
    if (remaining > 0) {
      this.resetCooldownRemainingMs = remaining;
      this.ensureCooldownTimer(email);
    } else {
      this.resetCooldownRemainingMs = 0;
      this.clearLastResetRequestAt(email);
    }
  }

  private startResetCooldown(email: string): void {
    this.setLastResetRequestAtMs(email, Date.now());
    this.resetCooldownRemainingMs = BusinessProfileComponent.RESET_REQUEST_COOLDOWN_MS;
    this.ensureCooldownTimer(email);
  }

  private ensureCooldownTimer(email: string): void {
    if (this.cooldownTimer) return;
    this.cooldownTimer = window.setInterval(() => {
      const lastAtMs = this.getLastResetRequestAtMs(email);
      if (!lastAtMs) {
        this.resetCooldownRemainingMs = 0;
        this.clearCooldownTimer();
        return;
      }

      const remaining = (lastAtMs + BusinessProfileComponent.RESET_REQUEST_COOLDOWN_MS) - Date.now();
      if (remaining <= 0) {
        this.resetCooldownRemainingMs = 0;
        this.clearLastResetRequestAt(email);
        this.clearCooldownTimer();
      } else {
        this.resetCooldownRemainingMs = remaining;
      }
    }, 1000);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer) {
      window.clearInterval(this.cooldownTimer);
      this.cooldownTimer = undefined;
    }
  }

  private getLastResetRequestAtMs(email: string): number | null {
    const raw = localStorage.getItem(this.getResetCooldownStorageKey(email));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private setLastResetRequestAtMs(email: string, valueMs: number): void {
    localStorage.setItem(this.getResetCooldownStorageKey(email), String(valueMs));
  }

  private clearLastResetRequestAt(email: string): void {
    localStorage.removeItem(this.getResetCooldownStorageKey(email));
  }

  private getResetCooldownStorageKey(email: string): string {
    return `pwd_reset_request_last_at:${email.toLowerCase().trim()}`;
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }
}
