import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import type { UserDto } from '../../../core/services/auth.service';

@Component({
  selector: 'app-home-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-header.component.html',
  styleUrl: './home-header.component.css'
})
export class HomeHeaderComponent {
  @Input() isAuthenticated = false;
  @Input() user: UserDto | null = null;
  @Input() showUserMenu = false;
  @Output() showUserMenuChange = new EventEmitter<boolean>();
  @Output() goToDashboard = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  toggleUserMenu(): void {
    this.showUserMenuChange.emit(!this.showUserMenu);
  }

  onGoToDashboard(): void {
    this.showUserMenuChange.emit(false);
    this.goToDashboard.emit();
  }

  onLogout(): void {
    this.showUserMenuChange.emit(false);
    this.logout.emit();
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
      this.showUserMenuChange.emit(false);
    }
  }
}
