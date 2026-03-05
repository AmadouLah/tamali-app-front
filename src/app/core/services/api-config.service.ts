import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private readonly baseUrl = environment.apiUrl;

  getApiUrl(): string {
    return this.baseUrl;
  }

  getAuthUrl(): string {
    return `${this.baseUrl}/auth`;
  }

  getUsersUrl(): string {
    return `${this.baseUrl}/users`;
  }

  getBusinessesUrl(): string {
    return `${this.baseUrl}/businesses`;
  }

  getBusinessSectorsUrl(): string {
    return `${this.baseUrl}/business-sectors`;
  }

  getReceiptTemplatesUrl(): string {
    return `${this.baseUrl}/receipt-templates`;
  }

  getServiceRequestsUrl(): string {
    return `${this.baseUrl}/service-requests`;
  }

  getSalesUrl(businessId: string): string {
    return `${this.baseUrl}/businesses/${businessId}/sales`;
  }

  getGenerateReceiptUrl(saleId: string): string {
    return `${this.baseUrl}/sales/${saleId}/generate-receipt`;
  }

  getReceiptHtmlUrl(saleId: string): string {
    return `${this.baseUrl}/sales/${saleId}/receipt-html`;
  }

  getProductsUrl(businessId: string): string {
    return `${this.baseUrl}/businesses/${businessId}/products`;
  }

  getProductCategoriesUrl(businessId: string): string {
    return `${this.baseUrl}/businesses/${businessId}/product-categories`;
  }

  getProductCategoryUrl(id: string): string {
    return `${this.baseUrl}/product-categories/${id}`;
  }

  getProductCategoryProductsCountUrl(id: string): string {
    return `${this.baseUrl}/product-categories/${id}/products-count`;
  }

  getProductUrl(id: string): string {
    return `${this.baseUrl}/products/${id}`;
  }

  getStockMovementUrl(productId: string): string {
    return `${this.baseUrl}/products/${productId}/stock-movements`;
  }

  getBusinessExportsBaseUrl(businessId: string): string {
    return `${this.baseUrl}/businesses/${businessId}/exports`;
  }

  getBusinessSalesExportUrl(businessId: string): string {
    return `${this.getBusinessExportsBaseUrl(businessId)}/sales`;
  }

  getStockMovementsExportUrl(businessId: string): string {
    return `${this.getBusinessExportsBaseUrl(businessId)}/stock-movements`;
  }

  getActivityLogExportUrl(businessId: string): string {
    return `${this.getBusinessExportsBaseUrl(businessId)}/activity-log`;
  }

  getSuperAdminDashboardUrl(): string {
    return `${this.baseUrl}/super-admin/dashboard`;
  }

  getSuperAdminBusinessesUrl(): string {
    return `${this.baseUrl}/super-admin/businesses`;
  }

  getAnnouncementCurrentUrl(): string {
    return `${this.baseUrl}/announcements/current`;
  }

  getSuperAdminAnnouncementsUrl(): string {
    return `${this.baseUrl}/super-admin/announcements`;
  }
}
