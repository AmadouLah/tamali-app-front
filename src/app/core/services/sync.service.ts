import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { NetworkService } from './network.service';
import { IndexedDbService } from './indexed-db.service';
import { ApiConfigService } from './api-config.service';
import { Observable, firstValueFrom, Subject } from 'rxjs';
import { timeout, retry, catchError, filter, debounceTime } from 'rxjs/operators';
import { throwError } from 'rxjs';

type PendingRequest = {
  id: string;
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
};

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly dbService = inject(IndexedDbService);
  private readonly apiConfig = inject(ApiConfigService);
  private syncPromise: Promise<void> | null = null;

  /** Émet à la fin de chaque synchronisation (succès ou échec) pour rafraîchir l'UI */
  readonly syncComplete$ = new Subject<void>();
  private readonly REQUEST_TIMEOUT = 10000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;
  private readonly CREATE_PRODUCT_REGEX = /\/businesses\/([^/]+)\/products$/;
  private readonly STOCK_MOVEMENT_REGEX = /\/products\/(local-product-[^/]+)\/stock-movements/;
  private readonly PRODUCT_PATCH_REGEX = /\/products\/(local-product-[^/]+)/;

  constructor() {
    this.networkService.onlineStatus.pipe(
      filter(isOnline => isOnline === true),
      debounceTime(1500)
    ).subscribe(() => this.syncPendingRequests());
  }

  async syncPendingRequests(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }
    this.syncPromise = this.doSync();
    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
      this.syncComplete$.next();
    }
  }

  private async doSync(): Promise<void> {
    const isReallyOnline = await this.networkService.checkConnection();
    if (!isReallyOnline) return;

    const pendingRequests = await this.dbService.getPendingRequests();
    if (pendingRequests.length === 0) return;

    const consolidated = await this.consolidateProductCreateWithStockAndPatch(pendingRequests);
    const uniqueRequests = await this.deduplicateRequests(consolidated);

    for (const request of uniqueRequests) {
      try {
        const stillOnline = await this.networkService.checkConnection();
        if (!stillOnline) break;

        // Retirer de la file avant d'exécuter pour qu'un autre run de sync ne renvoie pas la même requête
        await this.dbService.removePendingRequest(request.id);

        const response = await this.executeRequestWithRetry(request);

        if (request.method === 'POST' && request.url.includes('/sales') && response?.id) {
          const businessIdMatch = request.url.match(/\/businesses\/([^/]+)\/sales/);
          if (businessIdMatch) {
            const businessId = businessIdMatch[1];
            const localSales = await this.dbService.getLocalSales(businessId);
            const localSale = localSales.find(ls => ls.requestId === request.id);
            if (localSale) {
              const serverId = String(response.id);
              const receiptNumber = `INV-${serverId.replace(/-/g, '').toUpperCase()}`;
              await this.dbService.updateLocalSaleAfterSync(localSale.id, { serverId, receiptNumber });
            }
            await this.dbService.removeLocalStockMovementsByRequestId(request.id);
            await this.invalidateSalesCache(businessId);
          }
        }
        if (request.method === 'POST' && request.url.includes('/stock-movements') && response?.id) {
          await this.dbService.removeLocalStockMovementsByRequestId(request.id);
        }
        if (request.method === 'POST' && request.url.includes('/products') && !request.url.includes('/stock-movements') && response?.id) {
          await this.dbService.removeLocalProductByRequestId(request.id);
          const businessIdMatch = request.url.match(/\/businesses\/([^/]+)\/products/);
          if (businessIdMatch) await this.invalidateProductsCache(businessIdMatch[1]);
        }
        if ((request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE') &&
            (request.url.includes('/product-categories') || (request.url.includes('/products/') && !request.url.includes('/stock-movements')))) {
          await this.dbService.removeLocalEntityByRequestId(request.id);
        }
      } catch (error) {
        const httpError = error as HttpErrorResponse;
        const isNetworkError = !httpError?.status || httpError.status === 0;
        if (isNetworkError) {
          console.warn(`Erreur réseau lors de la synchronisation de la requête ${request.id}. Réessai ultérieur.`);
          await this.reEnqueueRequest(request);
          await this.networkService.checkConnection();
          break;
        } else {
          console.error(`Erreur serveur lors de la synchronisation de la requête ${request.id}:`, httpError);
        }
      }
    }
  }

  private async reEnqueueRequest(request: PendingRequest): Promise<void> {
    await this.dbService.addPendingRequest({
      id: request.id,
      method: request.method,
      url: request.url,
      body: request.body,
      headers: request.headers
    });
  }

  /**
   * Fusionne les créations de produits avec leurs mouvements de stock et PATCH locaux.
   * Un produit créé hors ligne avec id local-product-{requestId} peut avoir des stock-movements
   * et des PATCH en attente ; on fusionne tout en un seul POST create avec initialQuantity correct.
   */
  private async consolidateProductCreateWithStockAndPatch(requests: PendingRequest[]): Promise<PendingRequest[]> {
    const createByRequestId = new Map<string, PendingRequest>();
    const stockMovementsByLocalProductId = new Map<string, PendingRequest[]>();
    const patchesByLocalProductId = new Map<string, PendingRequest[]>();
    const toRemove = new Set<string>();
    const result: PendingRequest[] = [];

    for (const req of requests) {
      const createMatch = req.method === 'POST' ? req.url.match(this.CREATE_PRODUCT_REGEX) : null;
      const stockMatch = req.method === 'POST' ? req.url.match(this.STOCK_MOVEMENT_REGEX) : null;
      const patchMatch = req.method === 'PATCH' && !req.url.includes('/stock-movements')
        ? req.url.match(this.PRODUCT_PATCH_REGEX) : null;

      if (createMatch) {
        createByRequestId.set(req.id, req);
      } else if (stockMatch) {
        const localProductId = stockMatch[1];
        const list = stockMovementsByLocalProductId.get(localProductId) ?? [];
        list.push(req);
        stockMovementsByLocalProductId.set(localProductId, list);
      } else if (patchMatch) {
        const localProductId = patchMatch[1];
        const list = patchesByLocalProductId.get(localProductId) ?? [];
        list.push(req);
        patchesByLocalProductId.set(localProductId, list);
      }
    }

    for (const [createRequestId, createReq] of createByRequestId) {
      const localProductId = `local-product-${createRequestId}`;
      const stockMvts = stockMovementsByLocalProductId.get(localProductId) ?? [];
      const patches = patchesByLocalProductId.get(localProductId) ?? [];
      const sortedPatches = patches.sort((a, b) => a.timestamp - b.timestamp);
      let initialQty = Number(createReq.body?.initialQuantity ?? 0);

      for (const m of stockMvts) {
        const q = Math.abs(Number(m.body?.quantity ?? 0));
        const type = (m.body?.type ?? 'IN') as string;
        if (type === 'IN') initialQty += q;
        else initialQty = Math.max(0, initialQty - q);
        toRemove.add(m.id);
      }
      for (const p of sortedPatches) {
        toRemove.add(p.id);
      }

      const mergedBody = { ...createReq.body, initialQuantity: Math.max(0, Math.round(initialQty)) };
      for (const p of sortedPatches) {
        if (p.body && typeof p.body === 'object') {
          Object.assign(mergedBody, p.body);
        }
      }
      result.push({ ...createReq, body: mergedBody });
    }

    for (const req of requests) {
      if (createByRequestId.has(req.id)) continue;
      if (toRemove.has(req.id)) continue;
      result.push(req);
    }

    for (const id of toRemove) {
      const req = requests.find(r => r.id === id);
      if (req) {
        await this.removeLocalDataForRequest(req);
        await this.dbService.removePendingRequest(id);
      }
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  private async executeRequestWithRetry(request: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        return await this.executeRequest(request);
      } catch (error) {
        lastError = error;
        const httpError = error as HttpErrorResponse;
        const isNetworkError = !httpError?.status || httpError.status === 0;
        
        if (!isNetworkError) {
          // Erreur serveur : ne pas réessayer
          throw error;
        }
        
        if (attempt < this.MAX_RETRIES - 1) {
          // Attendre avant de réessayer avec délai exponentiel
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }

  private async executeRequest(request: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }): Promise<any> {
    const headers = new HttpHeaders(request.headers);
    
    let httpRequest: Observable<any>;
    
    switch (request.method.toUpperCase()) {
      case 'GET':
        httpRequest = this.http.get(request.url, { headers });
        break;
      case 'POST':
        httpRequest = this.http.post(request.url, request.body, { headers });
        break;
      case 'PUT':
        httpRequest = this.http.put(request.url, request.body, { headers });
        break;
      case 'PATCH':
        httpRequest = this.http.patch(request.url, request.body, { headers });
        break;
      case 'DELETE':
        httpRequest = this.http.delete(request.url, { headers });
        break;
      default:
        throw new Error(`Méthode HTTP non supportée: ${request.method}`);
    }

    return firstValueFrom(
      httpRequest.pipe(
        timeout(this.REQUEST_TIMEOUT),
        catchError(error => {
          if (error.name === 'TimeoutError') {
            return throwError(() => new HttpErrorResponse({
              error: 'Timeout',
              status: 0,
              statusText: 'Request Timeout'
            }));
          }
          return throwError(() => error);
        })
      )
    );
  }

  generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Stringify stable (clés triées) pour que deux body identiques produisent la même clé.
   */
  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(v => this.stableStringify(v)).join(',') + ']';
    const keys = Object.keys(value as object).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + this.stableStringify((value as Record<string, unknown>)[k]));
    return '{' + pairs.join(',') + '}';
  }

  /**
   * Clé canonique pour une vente (POST /sales) : tri des items par productId.
   */
  getSaleDedupKey(body: { cashierId?: string; method?: string; items?: Array<{ productId?: string; quantity?: number }> }): string {
    if (!body || typeof body !== 'object') return this.stableStringify(body);
    const items = Array.isArray(body.items) ? [...body.items] : [];
    items.sort((a, b) => (a?.productId ?? '').localeCompare(b?.productId ?? ''));
    return this.stableStringify({ ...body, items });
  }

  /**
   * Clé canonique pour une création produit (POST /products) : champs métier uniquement
   * pour que la même fiche produit ne soit synchronisée qu'une fois.
   */
  getProductCreateDedupKey(body: { name?: string; reference?: string; categoryId?: string; unitPrice?: number; purchasePrice?: number; taxable?: boolean }): string {
    if (!body || typeof body !== 'object') return this.stableStringify(body);
    const { name, reference, categoryId, unitPrice, purchasePrice, taxable } = body;
    return this.stableStringify({ name, reference, categoryId, unitPrice, purchasePrice, taxable });
  }

  private buildDedupKey(request: PendingRequest): string {
    const base = `${request.method}:${request.url}`;
    if (request.method === 'POST' && request.url.includes('/sales') && !request.url.includes('/stock-movements')) {
      return `${base}:${this.getSaleDedupKey(request.body || {})}`;
    }
    if (request.method === 'POST' && request.url.match(/\/businesses\/[^/]+\/products$/) && request.body) {
      return `${base}:${this.getProductCreateDedupKey(request.body)}`;
    }
    return `${base}:${this.stableStringify(request.body || {})}`;
  }

  private async deduplicateRequests(requests: Array<{
    id: string;
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    timestamp: number;
  }>): Promise<Array<{
    id: string;
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    timestamp: number;
  }>> {
    const seen = new Map<string, string>();
    const unique: typeof requests = [];
    const duplicatesToRemove: string[] = [];

    for (const request of requests) {
      const key = this.buildDedupKey(request);
      if (!seen.has(key)) {
        seen.set(key, request.id);
        unique.push(request);
      } else {
        duplicatesToRemove.push(request.id);
      }
    }

    const duplicateRequests = requests.filter(r => duplicatesToRemove.includes(r.id));
    for (const req of duplicateRequests) {
      await this.removeLocalDataForRequest(req);
      await this.dbService.removePendingRequest(req.id);
    }

    return unique;
  }

  private async invalidateSalesCache(businessId: string): Promise<void> {
    const salesUrl = `${this.apiConfig.getSalesUrl(businessId)}?page=0&size=20`;
    await this.dbService.removeCache(salesUrl);
  }

  private async invalidateProductsCache(businessId: string): Promise<void> {
    await this.dbService.removeCache(this.apiConfig.getProductsUrl(businessId));
  }

  private async removeLocalDataForRequest(request: {
    id: string;
    method: string;
    url: string;
  }): Promise<void> {
    const { id: requestId, url } = request;
    if (url.includes('/sales')) {
      const match = url.match(/\/businesses\/([^/]+)\/sales/);
      if (match) {
        const sales = await this.dbService.getLocalSales(match[1]);
        const found = sales.find(s => s.requestId === requestId);
        if (found) await this.dbService.removeLocalSale(found.id);
      }
      await this.dbService.removeLocalStockMovementsByRequestId(requestId);
    } else if (url.includes('/stock-movements')) {
      await this.dbService.removeLocalStockMovementsByRequestId(requestId);
    } else if (url.includes('/products') && !url.includes('/stock-movements')) {
      await this.dbService.removeLocalProductByRequestId(requestId);
      await this.dbService.removeLocalEntityByRequestId(requestId); // PATCH/DELETE product
    } else if (url.includes('/product-categories')) {
      await this.dbService.removeLocalEntityByRequestId(requestId);
    }
  }
}
