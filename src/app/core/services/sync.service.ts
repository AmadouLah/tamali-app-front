import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NetworkService } from './network.service';
import { IndexedDbService } from './indexed-db.service';
import { Observable, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly dbService = inject(IndexedDbService);
  private isSyncing = false;

  constructor() {
    this.networkService.onlineStatus.subscribe(isOnline => {
      if (isOnline && !this.isSyncing) {
        this.syncPendingRequests();
      }
    });
  }

  async syncPendingRequests(): Promise<void> {
    if (this.isSyncing || !this.networkService.isOnline) {
      return;
    }

    this.isSyncing = true;
    try {
      const pendingRequests = await this.dbService.getPendingRequests();
      
      for (const request of pendingRequests) {
        try {
          await this.executeRequest(request);
          await this.dbService.removePendingRequest(request.id);
        } catch (error) {
          console.error(`Erreur lors de la synchronisation de la requête ${request.id}:`, error);
        }
      }
    } finally {
      this.isSyncing = false;
    }
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

    return firstValueFrom(httpRequest);
  }

  generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
