import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from './api-config.service';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private onlineStatus$ = new BehaviorSubject<boolean>(navigator.onLine);
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 30000; // 30 secondes
  private readonly CHECK_TIMEOUT = 5000; // 5 secondes

  constructor() {
    if (typeof window !== 'undefined') {
      const online$ = fromEvent(window, 'online').pipe(map(() => true));
      const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
      
      merge(online$, offline$).subscribe(status => {
        this.onlineStatus$.next(status);
        if (status) {
          this.checkRealConnection();
        }
      });

      // Vérification périodique de la connexion réelle
      timer(0, this.CHECK_INTERVAL).subscribe(() => {
        if (navigator.onLine) {
          this.checkRealConnection();
        }
      });
    }
  }

  private async checkRealConnection(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCheckTime < this.CHECK_INTERVAL) {
      return;
    }
    this.lastCheckTime = now;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT);
      
      const baseUrl = this.apiConfig.getApiUrl().replace('/api', '');
      await fetch(`${baseUrl}/actuator/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      }).catch(() => {
        throw new Error('Connection failed');
      });
      
      clearTimeout(timeoutId);
      if (!this.onlineStatus$.value) {
        this.onlineStatus$.next(true);
      }
    } catch {
      if (this.onlineStatus$.value && navigator.onLine) {
        // Le navigateur dit qu'on est en ligne mais le serveur ne répond pas
        this.onlineStatus$.next(false);
      }
    }
  }

  get isOnline(): boolean {
    return this.onlineStatus$.value;
  }

  get onlineStatus(): Observable<boolean> {
    return this.onlineStatus$.asObservable();
  }

  async checkConnection(): Promise<boolean> {
    if (!navigator.onLine) {
      this.onlineStatus$.next(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT);
      
      const baseUrl = this.apiConfig.getApiUrl().replace('/api', '');
      await fetch(`${baseUrl}/actuator/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      this.onlineStatus$.next(true);
      return true;
    } catch {
      this.onlineStatus$.next(false);
      return false;
    }
  }

  whenOnline(): Promise<void> {
    if (this.isOnline) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const subscription = this.onlineStatus$.subscribe(status => {
        if (status) {
          subscription.unsubscribe();
          resolve();
        }
      });
    });
  }
}
