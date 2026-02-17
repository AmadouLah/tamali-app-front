import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

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

  @Input() menuItems: MenuItem[] = [];
  @Input() activeMenu: string = 'dashboard';
  @Output() menuClick = new EventEmitter<string>();

  ngOnInit(): void {
    this.updateActiveMenuFromRoute();
  }

  private updateActiveMenuFromRoute(): void {
    const currentRoute = this.router.url;
    if (currentRoute.includes('add-business-owner')) {
      this.activeMenu = 'ajouter propriétaire';
    } else if (currentRoute.includes('business-sectors')) {
      this.activeMenu = 'secteurs d\'activité';
    } else if (currentRoute.includes('account')) {
      this.activeMenu = 'mon compte';
    } else if (currentRoute.includes('admin')) {
      this.activeMenu = 'dashboard';
    }
  }

  onMenuClick(item: MenuItem): void {
    const menuKey = item.label.toLowerCase();
    this.activeMenu = menuKey;
    this.menuClick.emit(menuKey);
  }

}
