import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, UserDto } from '../../../../core/services/auth.service';
import { BusinessOperationsService } from '../../../../core/services/business-operations.service';
import { CustomerDetailsDto, CustomerSummaryDto, SaleDto } from '../../../../core/models/product.model';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { getBusinessMenuItems } from '../business-menu.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';

@Component({
  selector: 'app-business-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent, UserAvatarComponent],
  templateUrl: './business-clients.component.html',
  styleUrl: './business-clients.component.css'
})
export class BusinessClientsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly businessOps = inject(BusinessOperationsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  user: UserDto | null = null;
  businessId: string | null = null;
  clients: CustomerSummaryDto[] = [];
  selectedClient: CustomerDetailsDto | null = null;
  loading = true;
  detailsLoading = false;
  saving = false;
  deleting = false;
  editing = false;
  editName = '';
  editPhone = '';
  showDeleteConfirmation = false;
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
        this.resetEditForm();
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
    this.editing = false;
    this.showDeleteConfirmation = false;
  }

  startEditing(): void {
    if (!this.selectedClient) return;
    this.editing = true;
    this.editName = this.selectedClient.name;
    this.editPhone = this.selectedClient.phone ?? '';
  }

  cancelEditing(): void {
    this.editing = false;
    this.resetEditForm();
  }

  saveClient(): void {
    if (!this.businessId || !this.selectedClient || this.saving) return;
    const name = this.editName.trim();
    if (!name) {
      this.toast.error('Le nom du client est obligatoire.');
      return;
    }

    this.saving = true;
    this.businessOps.updateCustomer(this.businessId, this.selectedClient.id, {
      name,
      phone: this.editPhone
    }).subscribe({
      next: () => {
        this.toast.success('Client mis à jour.');
        this.editing = false;
        this.refreshAfterMutation(this.selectedClient!.id);
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Impossible de modifier le client.'));
        this.saving = false;
      }
    });
  }

  openDeleteConfirmation(): void {
    this.showDeleteConfirmation = true;
  }

  cancelDeleteConfirmation(): void {
    this.showDeleteConfirmation = false;
  }

  confirmDeleteClient(): void {
    if (!this.businessId || !this.selectedClient || this.deleting) return;
    this.deleting = true;
    const deletedId = this.selectedClient.id;
    this.businessOps.deleteCustomer(this.businessId, deletedId).subscribe({
      next: () => {
        this.toast.success('Client et ventes associées supprimés.');
        this.showDeleteConfirmation = false;
        this.selectedClient = null;
        this.loadClients();
        this.deleting = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Impossible de supprimer le client.'));
        this.deleting = false;
      }
    });
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

  private refreshAfterMutation(customerId: string): void {
    this.loadClients();
    this.businessOps.getCustomerDetails(this.businessId!, customerId).subscribe({
      next: (details) => {
        this.selectedClient = details;
        this.resetEditForm();
        this.saving = false;
      },
      error: () => {
        this.selectedClient = null;
        this.saving = false;
      }
    });
  }

  private resetEditForm(): void {
    this.editName = this.selectedClient?.name ?? '';
    this.editPhone = this.selectedClient?.phone ?? '';
  }
}
