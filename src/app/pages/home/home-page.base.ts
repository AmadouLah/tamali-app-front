import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, UserDto } from '../../core/services/auth.service';

export abstract class HomePageBase {
  protected readonly authService = inject(AuthService);
  protected readonly router = inject(Router);
  isAuthenticated = false;
  user: UserDto | null = null;

  protected initAuth(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.user = this.authService.getUser();
  }

  logout(): void {
    this.authService.logout();
    this.isAuthenticated = false;
    this.user = null;
    this.router.navigate(['/']);
  }
}
