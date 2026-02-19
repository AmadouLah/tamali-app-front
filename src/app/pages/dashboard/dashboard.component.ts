import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, UserDto } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-white mb-2">Tableau de bord</h1>
          <p class="text-gray-300">Redirection en cours...</p>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const user: UserDto | null = this.authService.getUser();
    
    if (!user || !user.roles || user.roles.length === 0) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.redirectBasedOnRole(user);
  }

  /**
   * Redirige l'utilisateur vers le dashboard approprié selon son rôle.
   * Méthode centralisée pour éviter la duplication de code.
   */
  private redirectBasedOnRole(user: UserDto): void {
    const roleType = user.roles?.[0]?.type;
    
    switch (roleType) {
      case 'SUPER_ADMIN':
        this.router.navigate(['/dashboard/admin']);
        break;
      case 'BUSINESS_OWNER':
        // Utiliser la méthode centralisée pour déterminer la redirection
        if (this.authService.shouldRedirectToSetup(user)) {
          this.router.navigate(['/business/setup'], { 
            queryParams: { userId: user.id }
          });
        } else {
          this.router.navigate(['/dashboard/business']);
        }
        break;
      case 'BUSINESS_ASSOCIATE':
        // Les associés accèdent au même dashboard que les propriétaires
        // Ils n'ont pas besoin de créer une entreprise car ils sont déjà liés à une
        if (!user.businessId) {
          // Cas improbable : un associé sans entreprise (erreur de configuration)
          this.router.navigate(['/auth/login']);
        } else {
          this.router.navigate(['/dashboard/business']);
        }
        break;
      default:
        this.router.navigate(['/auth/login']);
    }
  }
}
