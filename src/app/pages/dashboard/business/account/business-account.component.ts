import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { BUSINESS_OWNER_MENU_ITEMS } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

interface BusinessDto {
  id: string;
  name?: string;
}

@Component({
  selector: 'app-business-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent, UserAvatarComponent],
  templateUrl: './business-account.component.html',
  styleUrl: './business-account.component.css'
})
export class BusinessAccountComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  user: UserDto | null = null;
  business: BusinessDto | null = null;
  firstname = '';
  lastname = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;
  activeMenu = 'paramètres';
  sidebarOpen = false;

  readonly menuItems = BUSINESS_OWNER_MENU_ITEMS;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      if (this.user && this.authService.shouldRedirectToSetup(this.user)) {
        this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      } else {
        this.router.navigate(['/auth/login']);
      }
      return;
    }
    if (!this.user.businessId) {
      this.router.navigate(['/business/setup'], { queryParams: { userId: this.user.id } });
      return;
    }
    this.firstname = (this.user.firstname ?? '').trim();
    this.lastname = (this.user.lastname ?? '').trim();
    this.loadBusiness();
  }

  private loadBusiness(): void {
    if (!this.user?.businessId) return;
    this.http.get<BusinessDto>(`${this.apiConfig.getBusinessesUrl()}/${this.user.businessId}`).subscribe({
      next: (b) => (this.business = b),
      error: () => {}
    });
  }

  saveProfile(): void {
    if (!this.user) return;
    this.loading = true;
    this.error = null;
    this.success = null;
    this.authService.updateUserProfile(this.firstname.trim(), this.lastname.trim()).subscribe({
      next: () => {
        this.user = this.authService.getUser();
        this.success = 'Profil mis à jour.';
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Erreur lors de la mise à jour.';
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
