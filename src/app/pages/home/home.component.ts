import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { GlassCardComponent } from '../../shared/components/glass-card/glass-card.component';
import { HomeLayoutComponent } from '../../shared/components/home-layout/home-layout.component';
import { AuthService, UserDto } from '../../core/services/auth.service';
import { HOME_FEATURES } from './home-features.const';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, GlassCardComponent, HomeLayoutComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isAuthenticated = false;
  user: UserDto | null = null;
  features = HOME_FEATURES;

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

  logout(): void {
    this.authService.logout();
    this.isAuthenticated = false;
    this.user = null;
    this.router.navigate(['/']);
  }

}
