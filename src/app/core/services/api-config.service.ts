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

  getProductsUrl(businessId: string): string {
    return `${this.baseUrl}/businesses/${businessId}/products`;
  }

  getProductUrl(id: string): string {
    return `${this.baseUrl}/products/${id}`;
  }

  getStockMovementUrl(productId: string): string {
    return `${this.baseUrl}/products/${productId}/stock-movements`;
  }
}
