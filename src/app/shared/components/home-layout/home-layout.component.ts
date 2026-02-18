import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HomeHeaderComponent } from '../home-header/home-header.component';
import { HomeFooterComponent } from '../home-footer/home-footer.component';
import type { UserDto } from '../../../core/services/auth.service';

@Component({
  selector: 'app-home-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, HomeHeaderComponent, HomeFooterComponent],
  template: `
    <div class="home-layout min-h-screen relative overflow-x-hidden" data-theme="liquidGlace">
      <div class="liquid-gradient fixed inset-0 -z-10"></div>
      <div class="fixed inset-0 -z-10 bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-slate-900/90"></div>
      <div class="geometric-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>
      <app-home-header
        [isAuthenticated]="isAuthenticated"
        [user]="user"
        [showUserMenu]="showUserMenu"
        (showUserMenuChange)="showUserMenu = $event"
        (goToDashboard)="onGoToDashboard()"
        (logout)="logout.emit()"
      ></app-home-header>
      <main class="relative z-10">
        <ng-content></ng-content>
      </main>
      <app-home-footer></app-home-footer>
    </div>
  `,
  styles: [`
    .geometric-shapes { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; }
    .shape { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.3; animation: float-shape 20s ease-in-out infinite; }
    .shape-1 { width: 400px; height: 400px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); top: 10%; left: 10%; }
    .shape-2 { width: 300px; height: 300px; background: linear-gradient(135deg, #f093fb 0%, #4facfe 100%); top: 60%; right: 10%; animation-delay: 7s; }
    .shape-3 { width: 350px; height: 350px; background: linear-gradient(135deg, #764ba2 0%, #667eea 100%); bottom: 10%; left: 50%; animation-delay: 14s; }
    @keyframes float-shape { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(50px, -50px) scale(1.1); } 66% { transform: translate(-30px, 30px) scale(0.9); } }
    @media (max-width: 640px) { .shape { width: 200px; height: 200px; } }
  `]
})
export class HomeLayoutComponent {
  @Input() isAuthenticated = false;
  @Input() user: UserDto | null = null;
  showUserMenu = false;
  @Output() logout = new EventEmitter<void>();

  constructor(private readonly router: Router) {}

  onGoToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

}
