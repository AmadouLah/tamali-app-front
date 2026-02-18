import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="glass-effect-subtle border-t border-white/10 py-10 px-4 mt-24">
      <div class="container mx-auto">
        <div class="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 sm:gap-8 mb-6">
          <a routerLink="/" class="text-gray-400 hover:text-white transition-colors">Accueil</a>
          <a routerLink="/a-propos" class="text-gray-400 hover:text-white transition-colors">À propos</a>
          <a routerLink="/fonctionnalites" class="text-gray-400 hover:text-white transition-colors">Fonctionnalités</a>
          <a routerLink="/service-request" class="text-gray-400 hover:text-white transition-colors">Demander l'accès</a>
          <a routerLink="/auth/login" class="text-gray-400 hover:text-white transition-colors">Connexion</a>
        </div>
        <div class="text-center">
          <p class="text-gray-400 text-lg">&copy; {{ currentYear }}, Tamali. Tous droits réservés.</p>
          <p class="text-gray-500 text-sm mt-2">Solution de gestion pour les entreprises maliennes</p>
          <p class="text-xs text-gray-500 mt-2">
            Conçu par
            <a
              href="https://www.linkedin.com/in/amadou-landouré-154a0123a"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-gray-400 hover:text-purple-300 transition-colors"
            >
              BercAgency
            </a>
          </p>
        </div>
      </div>
    </footer>
  `
})
export class HomeFooterComponent {
  currentYear = new Date().getFullYear();
}
