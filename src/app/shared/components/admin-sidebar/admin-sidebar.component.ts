import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  badge?: number;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.css'
})
export class AdminSidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  @Input() menuItems: MenuItem[] = [];
  @Input() activeMenu: string = 'dashboard';
  @Input() mobileOpen = false;
  @Output() mobileOpenChange = new EventEmitter<boolean>();
  @Output() menuClick = new EventEmitter<string>();

  ngOnInit(): void {
    this.updateActiveMenuFromRoute();
  }

  private updateActiveMenuFromRoute(): void {
    const route = this.router.url;
    if (route.includes('add-business-owner')) {
      this.activeMenu = 'ajouter propriétaire';
    } else if (route.includes('business-sectors')) {
      this.activeMenu = 'secteurs d\'activité';
    } else if (route.includes('business/company')) {
      this.activeMenu = 'mon entreprise';
    } else if (route.includes('business/account')) {
      this.activeMenu = 'paramètres';
    } else if (route.includes('business/sales')) {
      this.activeMenu = 'ventes';
    } else if (route.includes('business/products')) {
      this.activeMenu = 'produits';
    } else if (route.includes('business/stock')) {
      this.activeMenu = 'stock';
    } else if (route.includes('admin/account')) {
      this.activeMenu = 'mon compte';
    } else if (route.includes('admin')) {
      this.activeMenu = 'dashboard';
    } else if (route.includes('business')) {
      this.activeMenu = 'dashboard';
    }
  }

  onMenuClick(item: MenuItem): void {
    const menuKey = item.label.toLowerCase();
    this.activeMenu = menuKey;
    this.menuClick.emit(menuKey);
    this.mobileOpenChange.emit(false);
  }

  closeMobile(): void {
    this.mobileOpenChange.emit(false);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
    this.mobileOpenChange.emit(false);
  }
}
