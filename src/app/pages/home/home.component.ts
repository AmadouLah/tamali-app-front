import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { GlassCardComponent } from '../../shared/components/glass-card/glass-card.component';
import { AuthService, UserDto } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, GlassCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isAuthenticated = false;
  user: UserDto | null = null;
  showUserMenu = false;

  features = [
    {
      icon: '📊',
      title: 'Gestion de Stock',
      description: 'Suivez vos produits en temps réel avec une gestion de stock intuitive et efficace.'
    },
    {
      icon: '💰',
      title: 'Comptabilité Simplifiée',
      description: 'Gérez vos ventes, achats et finances avec des outils adaptés aux entreprises maliennes.'
    },
    {
      icon: '🧾',
      title: 'Reçus Personnalisés',
      description: 'Créez des reçus professionnels avec vos propres templates et votre logo.'
    },
    {
      icon: '📱',
      title: 'Mode Offline',
      description: 'Fonctionne même sans connexion internet, synchronisation automatique dès le retour en ligne.'
    }
  ];

  ngOnInit(): void {
    this.checkAuthStatus();
    // Animation au scroll
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-visible');
        }
      });
    }, observerOptions);

    setTimeout(() => {
      document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    }, 100);
  }

  private checkAuthStatus(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.user = this.authService.getUser();
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
    this.showUserMenu = false;
  }

  logout(): void {
    this.authService.logout();
    this.isAuthenticated = false;
    this.user = null;
    this.showUserMenu = false;
    this.router.navigate(['/']);
  }

  getUserInitials(): string {
    if (!this.user) return '?';
    const first = this.user.firstname?.charAt(0).toUpperCase() || '';
    const last = this.user.lastname?.charAt(0).toUpperCase() || '';
    return (first + last) || this.user.email?.charAt(0).toUpperCase() || '?';
  }

  getUserDisplayName(): string {
    if (!this.user) return '';
    return `${this.user.firstname} ${this.user.lastname}`.trim() || this.user.email;
  }

  hasRoles(): boolean {
    return !!(this.user?.roles && this.user.roles.length > 0);
  }

  getRoleLabel(): string {
    if (!this.hasRoles()) return '';
    return this.user!.roles![0].type === 'SUPER_ADMIN' ? 'Super Admin' : 'Propriétaire';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.showUserMenu = false;
    }
  }

  ngOnDestroy(): void {
    // Cleanup si nécessaire
  }
}
