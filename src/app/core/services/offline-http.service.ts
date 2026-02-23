import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpRequest, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap, catchError, map, tap, filter } from 'rxjs/operators';
import { NetworkService } from './network.service';
import { IndexedDbService } from './indexed-db.service';
import { SyncService } from './sync.service';
import { ApiConfigService } from './api-config.service';

/**
 * Service HTTP offline-first qui gère automatiquement :
 * - La mise en cache des requêtes GET
 * - La mise en file d'attente des requêtes POST/PUT/PATCH/DELETE en mode offline
 * - La synchronisation automatique quand la connexion revient
 * 
 * Exemple d'utilisation :
 * ```typescript
 * constructor(private offlineHttp: OfflineHttpService) {}
 * 
 * loadData() {
 *   this.offlineHttp.get('/api/data').subscribe(data => {
 *     // Utilise les données depuis le cache si offline
 *   });
 * }
 * 
 * saveData(data: any) {
 *   this.offlineHttp.post('/api/data', data).subscribe(result => {
 *     // Mise en file d'attente si offline, synchronisation automatique après
 *   });
 * }
 * ```
 */
const TAX_RATE = 0.18;

@Injectable({
  providedIn: 'root'
})
export class OfflineHttpService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly dbService = inject(IndexedDbService);
  private readonly syncService = inject(SyncService);
  private readonly apiConfig = inject(ApiConfigService);

  request<T>(req: HttpRequest<any>): Observable<HttpEvent<T>> {
    // Suppression d'une entité locale non synchronisée : annuler la création (en ligne ou hors ligne)
    if (req.method === 'DELETE') {
      const categoryMatch = req.url.match(/\/product-categories\/(local-category-[^/?#]+)/);
      const productMatch = req.url.match(/\/products\/(local-product-[^/?#]+)/);
      const localId = categoryMatch?.[1] || productMatch?.[1];
      if (localId) {
        const prefix = localId.startsWith('local-category-') ? 'local-category-' : 'local-product-';
        const creationRequestId = localId.slice(prefix.length);
        return from(
          this.cancelLocalCreation(creationRequestId, prefix === 'local-category-' ? 'category' : 'product')
            .then(() => new HttpResponse({
              status: 202,
              statusText: 'Accepted - Création annulée',
              body: { requestId: creationRequestId }
            }))
        ).pipe(
          switchMap(res => {
            if (this.networkService.isOnline) this.syncService.syncPendingRequests();
            return of(res as HttpEvent<T>);
          })
        );
      }
    }

    const shouldQueue = this.shouldQueueRequest(req.method);
    
    if (this.networkService.isOnline) {
      return this.http.request<T>(req).pipe(
        switchMap(event => {
          if (event instanceof HttpResponse && req.method === 'GET') {
            this.cacheResponse(req.url, event.body).catch(console.error);
          }
          return of(event);
        }),
        catchError(error => {
          const isNetworkError = !error?.status || error.status === 0;
          if (shouldQueue && isNetworkError) {
            return this.queueRequest(req);
          }
          if (!shouldQueue) {
            return this.getFromCache<T>(req.url).pipe(
              catchError(() => {
                throw error;
              })
            );
          }
          throw error;
        })
      );
    } else {
      if (shouldQueue) {
        return this.queueRequest(req);
      }
      return this.getFromCache<T>(req.url);
    }
  }

  private toBody<T>(event: HttpEvent<T>): T {
    return (event as HttpResponse<T>).body as T;
  }

  get<T>(url: string, options?: any): Observable<T> {
    const req = new HttpRequest('GET', url, null, options);
    return this.request<T>(req).pipe(
      filter((event): event is HttpResponse<T> => event instanceof HttpResponse),
      map(event => this.toBody(event)),
      tap(data => {
        if (this.networkService.isOnline) {
          this.cacheResponse(url, data).catch(console.error);
        }
      })
    );
  }

  post<T>(url: string, body: any, options?: any): Observable<T> {
    const req = new HttpRequest('POST', url, body, options);
    return this.request<T>(req).pipe(
      filter((event): event is HttpResponse<T> => event instanceof HttpResponse),
      map(event => this.toBody(event))
    );
  }

  put<T>(url: string, body: any, options?: any): Observable<T> {
    const req = new HttpRequest('PUT', url, body, options);
    return this.request<T>(req).pipe(
      filter((event): event is HttpResponse<T> => event instanceof HttpResponse),
      map(event => this.toBody(event))
    );
  }

  patch<T>(url: string, body: any, options?: any): Observable<T> {
    const req = new HttpRequest('PATCH', url, body, options);
    return this.request<T>(req).pipe(
      filter((event): event is HttpResponse<T> => event instanceof HttpResponse),
      map(event => this.toBody(event))
    );
  }

  delete<T>(url: string, options?: any): Observable<T> {
    const req = new HttpRequest('DELETE', url, null, options);
    return this.request<T>(req).pipe(
      filter((event): event is HttpResponse<T> => event instanceof HttpResponse),
      map(event => this.toBody(event))
    );
  }

  private shouldQueueRequest(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }

  /** Une seule requête en file par "même" vente ou création produit (même contenu métier). */
  private async ensureSingleInQueue(req: HttpRequest<any>): Promise<{ requestId: string; isNew: boolean }> {
    if (req.method !== 'POST' || !req.body) {
      return { requestId: this.syncService.generateRequestId(), isNew: true };
    }
    const pending = await this.dbService.getPendingRequests();
    if (req.url.includes('/sales') && !req.url.includes('/stock-movements')) {
      const key = this.syncService.getSaleDedupKey(req.body);
      const existing = pending.find(
        r => r.method === 'POST' && r.url.includes('/sales') && this.syncService.getSaleDedupKey(r.body) === key
      );
      if (existing) return { requestId: existing.id, isNew: false };
    } else if (req.url.match(/\/businesses\/[^/]+\/products$/) && !req.url.includes('/stock-movements')) {
      const key = this.syncService.getProductCreateDedupKey(req.body);
      const existing = pending.find(
        r => r.method === 'POST' && r.url.match(/\/businesses\/[^/]+\/products$/) && this.syncService.getProductCreateDedupKey(r.body) === key
      );
      if (existing) return { requestId: existing.id, isNew: false };
    }
    return { requestId: this.syncService.generateRequestId(), isNew: true };
  }

  private queueRequest(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const headers: Record<string, string> = {};
    req.headers.keys().forEach(key => {
      headers[key] = req.headers.get(key) || '';
    });

    return from(
      this.ensureSingleInQueue(req).then(async ({ requestId, isNew }) => {
        if (isNew) {
          await this.dbService.addPendingRequest({
            id: requestId,
            method: req.method,
            url: req.url,
            body: req.body,
            headers
          });
        }
        // Si c'est une création de vente *nouvelle*, créer une vente locale enrichie
        if (isNew && req.method === 'POST' && req.url.includes('/sales') && req.body) {
          const businessIdMatch = req.url.match(/\/businesses\/([^/]+)\/sales/);
          if (businessIdMatch) {
            const businessId = businessIdMatch[1];
            const tempSaleId = `local-${requestId}`;
            const products = await this.dbService.getCache<any[]>(this.apiConfig.getProductsUrl(businessId)) ?? [];
            const productMap = new Map(products.map((p: any) => [p.id, p]));

            let totalAmount = 0;
            let taxAmount = 0;
            const items = (req.body.items || []).map((item: any) => {
              const product = productMap.get(item.productId);
              const unitPrice = product?.unitPrice ?? 0;
              const taxable = product?.taxable ?? false;
              const lineTTC = unitPrice * (item.quantity ?? 0);
              let lineTax = 0;
              if (taxable) {
                const lineHT = lineTTC / (1 + TAX_RATE);
                lineTax = lineTTC - lineHT;
              }
              totalAmount += lineTTC;
              taxAmount += lineTax;
              return {
                id: `temp-${Date.now()}-${Math.random()}`,
                productId: item.productId,
                productName: product?.name ?? 'Produit',
                quantity: item.quantity ?? 0,
                price: unitPrice
              };
            });

            const localSale = {
              id: tempSaleId,
              businessId,
              cashierId: req.body.cashierId,
              items,
              totalAmount,
              taxAmount,
              saleDate: new Date().toISOString()
            };

            await this.dbService.addLocalSale({
              id: tempSaleId,
              businessId,
              sale: localSale,
              requestId
            });
          }
        }
        if (isNew && req.method === 'POST' && req.url.includes('/stock-movements') && req.body) {
          const productIdMatch = req.url.match(/\/products\/([^/]+)\/stock-movements/);
          if (productIdMatch) {
            const productId = productIdMatch[1];
            const movementId = `stock-movement-${requestId}`;
            await this.dbService.addLocalStockMovement({
              id: movementId,
              productId,
              quantity: req.body.quantity || 0,
              type: req.body.type || 'IN',
              requestId
            });
          }
        }
        if (isNew && req.method === 'POST' && req.url.includes('/products') && !req.url.includes('/stock-movements') && req.body) {
          const businessIdMatch = req.url.match(/\/businesses\/([^/]+)\/products/);
          if (businessIdMatch) {
            const businessId = businessIdMatch[1];
            const tempProductId = `local-product-${requestId}`;
            const localProduct = {
              id: tempProductId,
              businessId,
              name: req.body.name || '',
              reference: req.body.reference || undefined,
              categoryId: req.body.categoryId || undefined,
              unitPrice: req.body.unitPrice || 0,
              purchasePrice: req.body.purchasePrice || undefined,
              taxable: req.body.taxable || false,
              stockQuantity: req.body.initialQuantity || 0,
              categoryName: undefined
            };
            
            await this.dbService.addLocalProduct({
              id: tempProductId,
              businessId,
              product: localProduct,
              requestId
            });
          }
        }
        // Si c'est une création/modification/suppression de catégorie
        if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') && req.url.includes('/product-categories')) {
          const businessIdMatch = req.url.match(/\/businesses\/([^/]+)\/product-categories/);
          const categoryIdMatch = req.url.match(/\/product-categories\/([^/]+)/);
          if (businessIdMatch || categoryIdMatch) {
            const businessId = businessIdMatch ? businessIdMatch[1] : null;
            const categoryId = categoryIdMatch ? categoryIdMatch[1] : `local-category-${requestId}`;
            
            if (businessId || categoryId) {
              let entityData: Record<string, unknown> = {};
              if (req.method === 'POST' && req.body) {
                entityData = { name: req.body.name || '', businessId };
              } else if (req.method === 'PATCH' && req.body) {
                entityData = { name: req.body.name || '' };
              }
              
              await this.dbService.addLocalEntity({
                id: `local-entity-${requestId}`,
                entityType: 'category',
                businessId: businessId || '',
                entityId: categoryId,
                entity: entityData,
                operation: req.method,
                requestId
              });
            }
          }
        }
        // Si c'est une modification/suppression de produit
        if ((req.method === 'PATCH' || req.method === 'DELETE') && req.url.includes('/products/') && !req.url.includes('/stock-movements')) {
          const productIdMatch = req.url.match(/\/products\/([^/]+)/);
          const businessIdMatch = req.url.match(/\/businesses\/([^/]+)\//);
          if (productIdMatch) {
            const productId = productIdMatch[1];
            const businessId = businessIdMatch ? businessIdMatch[1] : '';
            
            let entityData: Record<string, unknown> = {};
            if (req.method === 'PATCH' && req.body) {
              entityData = { ...req.body };
            }
            
            await this.dbService.addLocalEntity({
              id: `local-entity-${requestId}`,
              entityType: 'product',
              businessId,
              entityId: productId,
              entity: entityData,
              operation: req.method,
              requestId
            });
          }
        }
        return requestId;
      })
    ).pipe(
      switchMap((requestId: string) => {
        if (this.networkService.isOnline) {
          this.syncService.syncPendingRequests();
        }
        return of(new HttpResponse({
          status: 202,
          statusText: 'Accepted - En attente de synchronisation',
          body: { requestId }
        }));
      })
    );
  }

  private getFromCache<T>(url: string): Observable<HttpEvent<T>> {
    return from(this.dbService.getCache<T>(url)).pipe(
      switchMap(cached => {
        if (cached) {
          return of(new HttpResponse({ body: cached }) as HttpEvent<T>);
        }
        return of(new HttpResponse({
          status: 503,
          statusText: 'Service Unavailable - Mode hors ligne',
          body: { message: 'Données non disponibles en mode hors ligne' } as T
        }) as HttpEvent<T>);
      })
    );
  }

  async cacheResponse(url: string, data: any, ttl: number = 3600000): Promise<void> {
    await this.dbService.setCache(url, data, ttl);
  }

  private async cancelLocalCreation(requestId: string, entityType: 'category' | 'product'): Promise<void> {
    await this.dbService.removePendingRequest(requestId);
    if (entityType === 'category') {
      await this.dbService.removeLocalEntityByRequestId(requestId);
    } else {
      await this.dbService.removeLocalProductByRequestId(requestId);
    }
  }
}
