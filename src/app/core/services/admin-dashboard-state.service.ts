import { Injectable } from '@angular/core';
import type { SuperAdminDashboard, BusinessSummaryDto, ServiceRequestDto } from '../models/super-admin-dashboard.types';

/**
 * Garde en mémoire les données du tableau de bord Super Admin pour éviter
 * de recharger à chaque visite. Actualisation uniquement via le bouton "Actualiser".
 */
@Injectable({ providedIn: 'root' })
export class AdminDashboardStateService {
  private dashboard: SuperAdminDashboard | null = null;
  private businesses: BusinessSummaryDto[] = [];
  private serviceRequests: ServiceRequestDto[] = [];

  hasData(): boolean {
    return this.dashboard != null;
  }

  getDashboard(): SuperAdminDashboard | null {
    return this.dashboard;
  }

  getBusinesses(): BusinessSummaryDto[] {
    return this.businesses;
  }

  getServiceRequests(): ServiceRequestDto[] {
    return this.serviceRequests;
  }

  setDashboard(value: SuperAdminDashboard | null): void {
    this.dashboard = value;
  }

  setBusinesses(value: BusinessSummaryDto[]): void {
    this.businesses = value;
  }

  setServiceRequests(value: ServiceRequestDto[]): void {
    this.serviceRequests = value;
  }
}
