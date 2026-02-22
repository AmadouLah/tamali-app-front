import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { NetworkService } from './network.service';
import { IndexedDbService } from './indexed-db.service';
import { Observable, firstValueFrom, timer, Subject } from 'rxjs';
import { timeout, retry, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly dbService = inject(IndexedDbService);
  private isSyncing = false;

  /** Émet à la fin de chaque synchronisation (succès ou échec) pour rafraîchir l'UI */
  readonly syncComplete$ = new Subject<void>();
  private readonly REQUEST_TIMEOUT = 10000; // 10 secondes
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 secondes

  constructor() {
    this.networkService.onlineStatus.subscribe(isOnline => {
      if (isOnline && !this.isSyncing) {
        // Délai pour s'assurer que la connexion est stable
        setTimeout(() => this.syncPendingRequests(), 1000);
      }
    });
  }

  async syncPendingRequests(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    // Vérifier la connexion réelle avant de synchroniser
    const isReallyOnline = await this.networkService.checkConnection();
    if (!isReallyOnline) {
      return;
    }

    this.isSyncing = true;
    try {
      const pendingRequests = await this.dbService.getPendingRequests();
      
      if (pendingRequests.length === 0) {
        return;
      }

      // Éviter les duplications : regrouper les requêtes identiques par URL et body
      const uniqueRequests = await this.deduplicateRequests(pendingRequests);

      for (const request of uniqueRequests) {
        try {
          // Vérifier à nouveau la connexion avant chaque requête
          const stillOnline = await this.networkService.checkConnection();
          if (!stillOnline) {
            break;
          }

          const response = await this.executeRequestWithRetry(request);
          
          // Si c'est une création de vente réussie, supprimer la vente locale
          // car elle sera maintenant disponible depuis le serveur avec le vrai ID
          if (request.method === 'POST' && request.url.includes('/sales') && response?.id) {
            const businessIdMatch = request.url.match(/\/businesses\/([^/]+)\/sales/);
            if (businessIdMatch) {
              const businessId = businessIdMatch[1];
              const localSales = await this.dbService.getLocalSales(businessId);
              const localSale = localSales.find(ls => ls.requestId === request.id);
              if (localSale) {
                await this.dbService.removeLocalSale(localSale.id);
              }
              // Supprimer aussi les mouvements de stock locaux associés
              await this.dbService.removeLocalStockMovementsByRequestId(request.id);
            }
          }
          
          // Si c'est un mouvement de stock réussi, supprimer le mouvement local
          if (request.method === 'POST' && request.url.includes('/stock-movements') && response?.id) {
            await this.dbService.removeLocalStockMovementsByRequestId(request.id);
          }
          
          // Si c'est une création de produit réussie, supprimer le produit local
          if (request.method === 'POST' && request.url.includes('/products') && !request.url.includes('/stock-movements') && response?.id) {
            await this.dbService.removeLocalProductByRequestId(request.id);
          }
          
          // Si c'est une opération sur une entité générique (catégorie, modification produit, etc.)
          if ((request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE') && 
              (request.url.includes('/product-categories') || 
               (request.url.includes('/products/') && !request.url.includes('/stock-movements')))) {
            await this.dbService.removeLocalEntityByRequestId(request.id);
          }
          
          await this.dbService.removePendingRequest(request.id);
        } catch (error) {
          const httpError = error as HttpErrorResponse;
          const isNetworkError = !httpError?.status || httpError.status === 0;
          
          if (isNetworkError) {
            // Erreur réseau : garder la requête pour réessayer plus tard
            console.warn(`Erreur réseau lors de la synchronisation de la requête ${request.id}. Réessai ultérieur.`);
            // Mettre à jour le statut de connexion
            await this.networkService.checkConnection();
            break; // Arrêter la synchronisation si erreur réseau
          } else {
            // Erreur serveur (4xx, 5xx) : supprimer la requête pour éviter les boucles infinies
            console.error(`Erreur serveur lors de la synchronisation de la requête ${request.id}:`, httpError);
            await this.dbService.removePendingRequest(request.id);
          }
        }
      }
    } finally {
      this.isSyncing = false;
      this.syncComplete$.next();
    }
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
      // Créer une clé unique basée sur l'URL et le body
      const key = `${request.method}:${request.url}:${JSON.stringify(request.body || {})}`;
      
      if (!seen.has(key)) {
        seen.set(key, request.id);
        unique.push(request);
      } else {
        // Marquer les requêtes dupliquées pour suppression
        duplicatesToRemove.push(request.id);
      }
    }

    // Supprimer les requêtes dupliquées
    for (const id of duplicatesToRemove) {
      await this.dbService.removePendingRequest(id);
    }

    return unique;
  }
}
