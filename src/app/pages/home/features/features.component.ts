import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HomeLayoutComponent } from '../../../shared/components/home-layout/home-layout.component';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { HomePageBase } from '../home-page.base';
import { HOME_FEATURES } from '../home-features.const';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule, RouterModule, HomeLayoutComponent, GlassCardComponent],
  template: `
    <app-home-layout
      [isAuthenticated]="isAuthenticated"
      [user]="user"
      (logout)="logout()"
    >
      <section class="py-16 sm:py-24 px-4">
        <div class="container mx-auto">
          <h1 class="text-4xl sm:text-5xl font-bold text-white mb-4 text-center">
            Fonctionnalités
          </h1>
          <p class="text-xl text-gray-300 text-center mb-12 max-w-2xl mx-auto">
            Tout ce dont vous avez besoin pour gérer votre entreprise efficacement
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            @for (feature of features; track feature.title) {
              <app-glass-card variant="strong" class="p-6 sm:p-8">
                <div class="flex flex-col sm:flex-row gap-6">
                  <div class="glass-effect-subtle w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shrink-0">
                    {{ feature.icon }}
                  </div>
                  <div>
                    <h2 class="text-xl sm:text-2xl font-bold text-white mb-3">{{ feature.title }}</h2>
                    <p class="text-gray-300 mb-4">{{ feature.description }}</p>
                    @if (feature.details) {
                      <p class="text-gray-400 text-sm">{{ feature.details }}</p>
                    }
                  </div>
                </div>
              </app-glass-card>
            }
          </div>
          <div class="text-center mt-12">
            <a
              routerLink="/service-request"
              class="btn btn-primary glow-effect-hover px-8 py-3 rounded-full"
            >
              Demander l'accès
            </a>
          </div>
        </div>
      </section>
    </app-home-layout>
  `
})
export class FeaturesComponent extends HomePageBase implements OnInit {
  features = HOME_FEATURES;

  ngOnInit(): void {
    this.initAuth();
  }
}
