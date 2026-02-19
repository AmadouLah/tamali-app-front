import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { OfflineHttpService } from './offline-http.service';
import { ApiConfigService } from './api-config.service';
import type {
  ProductDto,
  ProductCategoryDto,
  SaleDto,
  SaleCreateRequest,
  ProductCreateRequest,
  ProductUpdateRequest,
  StockMovementCreateRequest
} from '../models/product.model';

const OFFLINE_MESSAGE = 'Données non disponibles en mode hors ligne';

function isOfflineEmptyResponse(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { message?: string }).message === OFFLINE_MESSAGE
  );
}

/** Indique si la réponse correspond à une requête mise en file (sync à la reconnexion). */
export function isPendingResponse(body: unknown): body is { requestId: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'requestId' in body &&
    typeof (body as { requestId?: string }).requestId === 'string'
  );
}

/**
 * Service des opérations métier entreprise (ventes, produits, stock).
 * Offline-first : GET depuis le cache si hors ligne, POST/PATCH/DELETE mis en file et synchronisés au retour en ligne.
 */
@Injectable({
  providedIn: 'root'
})
export class BusinessOperationsService {
  private readonly offlineHttp = inject(OfflineHttpService);
  private readonly apiConfig = inject(ApiConfigService);

  getBusiness(businessId: string): Observable<Record<string, unknown> | null> {
    const url = `${this.apiConfig.getBusinessesUrl()}/${businessId}`;
    return this.offlineHttp.get<Record<string, unknown>>(url).pipe(
      map(body => (isOfflineEmptyResponse(body) ? null : body))
    );
  }

  getProducts(businessId: string): Observable<ProductDto[]> {
    const url = this.apiConfig.getProductsUrl(businessId);
    return this.offlineHttp.get<ProductDto[] | { message: string }>(url).pipe(
      map(body => (Array.isArray(body) ? body : []))
    );
  }

  getProductCategories(businessId: string): Observable<ProductCategoryDto[]> {
    const url = this.apiConfig.getProductCategoriesUrl(businessId);
    return this.offlineHttp.get<ProductCategoryDto[] | { message: string }>(url).pipe(
      map(body => (Array.isArray(body) ? body : []))
    );
  }

  createProductCategory(businessId: string, name: string): Observable<ProductCategoryDto | { requestId: string }> {
    return this.offlineHttp.post<ProductCategoryDto | { requestId: string }>(
      this.apiConfig.getProductCategoriesUrl(businessId),
      { name }
    );
  }

  updateProductCategory(id: string, name: string): Observable<ProductCategoryDto | { requestId: string }> {
    return this.offlineHttp.patch<ProductCategoryDto | { requestId: string }>(
      this.apiConfig.getProductCategoryUrl(id),
      { name }
    );
  }

  deleteProductCategory(id: string): Observable<void | { requestId: string }> {
    return this.offlineHttp.delete<void | { requestId: string }>(this.apiConfig.getProductCategoryUrl(id));
  }

  getSales(businessId: string, page = 0, size = 20): Observable<SaleDto[]> {
    const url = `${this.apiConfig.getSalesUrl(businessId)}?page=${page}&size=${size}`;
    return this.offlineHttp.get<SaleDto[] | { message: string }>(url).pipe(
      map(body => (Array.isArray(body) ? body : []))
    );
  }

  createSale(businessId: string, body: SaleCreateRequest): Observable<SaleDto | { requestId: string }> {
    const url = this.apiConfig.getSalesUrl(businessId);
    return this.offlineHttp.post<SaleDto | { requestId: string }>(url, body);
  }

  createProduct(businessId: string, body: ProductCreateRequest): Observable<ProductDto | { requestId: string }> {
    const url = this.apiConfig.getProductsUrl(businessId);
    return this.offlineHttp.post<ProductDto | { requestId: string }>(url, body);
  }

  updateProduct(productId: string, body: ProductUpdateRequest): Observable<ProductDto | { requestId: string }> {
    const url = this.apiConfig.getProductUrl(productId);
    return this.offlineHttp.patch<ProductDto | { requestId: string }>(url, body);
  }

  deleteProduct(productId: string): Observable<void | { requestId: string }> {
    const url = this.apiConfig.getProductUrl(productId);
    return this.offlineHttp.delete<void | { requestId: string }>(url);
  }

  postStockMovement(productId: string, body: StockMovementCreateRequest): Observable<unknown> {
    const url = this.apiConfig.getStockMovementUrl(productId);
    return this.offlineHttp.post<unknown>(url, body);
  }
}
