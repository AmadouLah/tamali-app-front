import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HomeLayoutComponent } from '../../../shared/components/home-layout/home-layout.component';
import { HomePageBase } from '../home-page.base';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule, HomeLayoutComponent],
  template: `
    <app-home-layout
      [isAuthenticated]="isAuthenticated"
      [user]="user"
      (logout)="logout()"
    >
      <section class="py-16 sm:py-24 px-4">
        <div class="container mx-auto max-w-4xl">
          <h1 class="text-4xl sm:text-5xl font-bold text-white mb-8 text-center">
            À propos de Tamali
          </h1>
          <div class="space-y-8 text-gray-300 leading-relaxed">
            <p class="text-lg">
              <strong class="text-white">Tamali</strong> est une plateforme de gestion conçue pour les entreprises maliennes.
              Notre mission : simplifier la gestion quotidienne des commerces et PME avec des outils modernes, accessibles et adaptés au contexte local.
            </p>
            <p>
              Que vous gériez un petit commerce, une boutique ou une activité plus structurée, Tamali met à votre disposition tout ce qu'il faut pour suivre vos produits, vos ventes et vos finances en un seul endroit.
            </p>
            <h2 class="text-2xl font-bold text-white mt-12 mb-4">Notre engagement</h2>
            <p>
              Nous croyons que chaque entreprise mérite des outils performants. Tamali combine simplicité d'utilisation, robustesse et capacité de fonctionnement hors ligne pour répondre aux réalités du terrain.
            </p>
            <div class="pt-8 text-center">
              <a
                routerLink="/service-request"
                class="btn btn-primary glow-effect-hover px-8 py-3 rounded-full"
              >
                Demander l'accès
              </a>
            </div>
          </div>
        </div>
      </section>
    </app-home-layout>
  `
})
export class AboutComponent extends HomePageBase implements OnInit {
  ngOnInit(): void {
    this.initAuth();
  }
}
