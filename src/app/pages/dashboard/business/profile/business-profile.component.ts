import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
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
export class BusinessProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user: UserDto | null = null;
  form!: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;
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
  }

  submit(): void {
    if (this.form.invalid || this.loading || !this.user?.id) return;
    this.loading = true;
    this.error = null;
    this.success = null;
    this.authService.changePassword(
      this.user.id,
      this.form.value.currentPassword,
      this.form.value.newPassword
    ).subscribe({
      next: () => {
        this.success = 'Mot de passe modifié.';
        this.form.reset();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Erreur lors du changement.';
        this.loading = false;
      }
    });
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }
}
