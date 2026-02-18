import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpRequest, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap, catchError, map, tap, filter } from 'rxjs/operators';
import { NetworkService } from './network.service';
import { IndexedDbService } from './indexed-db.service';
import { SyncService } from './sync.service';

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
@Injectable({
  providedIn: 'root'
})
export class OfflineHttpService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly dbService = inject(IndexedDbService);
  private readonly syncService = inject(SyncService);

  request<T>(req: HttpRequest<any>): Observable<HttpEvent<T>> {
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

  private queueRequest(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    const requestId = this.syncService.generateRequestId();
    const headers: Record<string, string> = {};
    req.headers.keys().forEach(key => {
      headers[key] = req.headers.get(key) || '';
    });

    return from(
      this.dbService.addPendingRequest({
        id: requestId,
        method: req.method,
        url: req.url,
        body: req.body,
        headers
      })
    ).pipe(
      switchMap(() => {
        if (this.networkService.isOnline) {
          this.syncService.syncPendingRequests();
        }
        return of(new HttpResponse({
          status: 202,
          statusText: 'Accepted - En attente de synchronisation',
          body: { message: 'Requête mise en file d\'attente', requestId }
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
}
