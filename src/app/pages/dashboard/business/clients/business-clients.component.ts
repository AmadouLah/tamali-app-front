import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService } from '../../../../core/services/business-operations.service';
import { CustomerDetailsDto, CustomerSummaryDto, SaleDto } from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-business-clients',
  standalone: true,
  imports: [CommonModule, RouterModule, GlassCardComponent, AdminSidebarComponent, UserAvatarComponent],
  templateUrl: './business-clients.component.html',
  styleUrl: './business-clients.component.css'
})
export class BusinessClientsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly router = inject(Router);

  user: UserDto | null = null;
  businessId: string | null = null;
  clients: CustomerSummaryDto[] = [];
  selectedClient: CustomerDetailsDto | null = null;
  loading = true;
  detailsLoading = false;
  activeMenu = 'clients';
  sidebarOpen = false;
  menuItems = getBusinessMenuItems(null);

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.menuItems = getBusinessMenuItems(this.user);
    if (!this.authService.canAccessBusinessDashboard(this.user)) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.businessId = this.user?.businessId ?? null;
    this.loadClients();
  }

  loadClients(): void {
    if (!this.businessId) return;
    this.loading = true;
    this.businessOps.getCustomers(this.businessId).subscribe({
      next: (clients) => {
        this.clients = clients;
        this.loading = false;
      },
      error: () => {
        this.clients = [];
        this.loading = false;
      }
    });
  }

  openClientDetails(client: CustomerSummaryDto): void {
    if (!this.businessId) return;
    this.detailsLoading = true;
    this.businessOps.getCustomerDetails(this.businessId, client.id).subscribe({
      next: (details) => {
        this.selectedClient = details;
        this.detailsLoading = false;
      },
      error: () => {
        this.selectedClient = null;
        this.detailsLoading = false;
      }
    });
  }

  closeDetails(): void {
    this.selectedClient = null;
  }

  setActiveMenu(menu: string): void {
    this.activeMenu = menu;
  }

  formatMoney(amount: number): string {
    return `${(amount ?? 0).toLocaleString('fr-FR')} FCFA`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDisplayName(): string {
    return this.authService.getDisplayName(this.user);
  }

  trackByClientId(_: number, client: CustomerSummaryDto): string {
    return client.id;
  }

  trackBySaleId(_: number, sale: SaleDto): string {
    return sale.id;
  }
}
