import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, from, of } from 'rxjs';
import { catchError, switchMap, take, timeout } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface PushSettingsState {
  kind: 'unsupported' | 'denied' | 'inactive' | 'active';
  /** false si l’API ne publie pas de clé VAPID (ex. variables manquantes sur le serveur). */
  serverPushConfigured: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebPushRegistrationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfigService);

  private static readonly RETRY_MS = 3000;
  private static readonly MAX_ATTEMPTS = 5;
  /** SwPush.subscription peut ne jamais émettre ; sans borne, firstValueFrom bloque indéfiniment. */
  private static readonly RX_FIRST_MS = 5000;

  private vapidPublicKey: string | null = null;

  tryRegister(): void {
    if (!this.isEligibleForPush()) return;
    void this.runRegistration(0);
  }

  resetCachedVapidKey(): void {
    this.vapidPublicKey = null;
  }

  /** Activation explicite (paramètres utilisateur) : demande la permission navigateur puis enregistre l’abonnement. */
  async enableFromSettings(): Promise<boolean> {
    if (typeof window === 'undefined' || !this.swPush.isEnabled || !('Notification' in window)) return false;
    if (!localStorage.getItem('auth_token')) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return false;
    }
    for (let i = 0; i < 4; i++) {
      if (await this.attemptSubscribeOnce()) return true;
      await new Promise(r => setTimeout(r, WebPushRegistrationService.RETRY_MS));
    }
    return false;
  }

  /** Désactivation : retire l’abonnement côté serveur et côté navigateur. */
  async disableFromSettings(): Promise<void> {
    const sub = await this.readPushSubscriptionSnapshot();
    const endpoint = sub?.endpoint;
    if (endpoint) {
      try {
        await firstValueFrom(
          this.http.delete<void>(this.api.getPushSubscribeUrl(), { body: { endpoint } })
        );
      } catch {
        /* on poursuit la désinscription navigateur */
      }
    }
    try {
      await this.swPush.unsubscribe();
    } catch {
      /* ignore */
    }
  }

  async getPushSettingsState(): Promise<PushSettingsState> {
    if (typeof window === 'undefined' || !this.swPush.isEnabled || !('Notification' in window)) {
      return { kind: 'unsupported', serverPushConfigured: false };
    }
    if (Notification.permission === 'denied') {
      return { kind: 'denied', serverPushConfigured: await this.fetchServerPushConfigured() };
    }
    const [sub, serverPushConfigured] = await Promise.all([
      this.readPushSubscriptionSnapshot(),
      this.fetchServerPushConfigured()
    ]);
    if (sub) {
      return { kind: 'active', serverPushConfigured: true };
    }
    return { kind: 'inactive', serverPushConfigured };
  }

  private async readPushSubscriptionSnapshot(): Promise<PushSubscription | null> {
    if (!this.swPush.isEnabled) return null;
    try {
      return await firstValueFrom(
        this.swPush.subscription.pipe(
          timeout(WebPushRegistrationService.RX_FIRST_MS),
          take(1),
          catchError(() => of(null))
        )
      );
    } catch {
      return null;
    }
  }

  private isEligibleForPush(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.swPush.isEnabled) return false;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    return !!(localStorage.getItem('auth_token') && localStorage.getItem('auth_user'));
  }

  private async runRegistration(attempt: number): Promise<void> {
    const ok = await this.attemptSubscribeOnce();
    if (ok) return;
    if (Notification.permission === 'denied') return;
    if (!this.isEligibleForPush()) return;
    this.scheduleRetry(attempt);
  }

  private async attemptSubscribeOnce(): Promise<boolean> {
    if (!this.isEligibleForPush()) return false;
    try {
      await navigator.serviceWorker.ready;
    } catch {
      return false;
    }
    if (!this.isEligibleForPush()) return false;
    const pk = await this.loadVapidPublicKey();
    if (!pk) return false;
    try {
      const sub = await firstValueFrom(
        this.swPush.subscription.pipe(
          take(1),
          switchMap(existing =>
            existing ? of(existing) : from(this.swPush.requestSubscription({ serverPublicKey: pk }))
          )
        )
      );
      await firstValueFrom(this.http.post(this.api.getPushSubscribeUrl(), sub.toJSON()));
      return true;
    } catch {
      return false;
    }
  }

  private scheduleRetry(attempt: number): void {
    if (attempt >= WebPushRegistrationService.MAX_ATTEMPTS - 1) return;
    setTimeout(() => void this.runRegistration(attempt + 1), WebPushRegistrationService.RETRY_MS);
  }

  private async loadVapidPublicKey(): Promise<string> {
    const cached = this.vapidPublicKey?.trim();
    if (cached) return cached;
    try {
      const r = await firstValueFrom(
        this.http.get<{ publicKey: string }>(this.api.getPushVapidPublicKeyUrl())
      );
      const k = r.publicKey?.trim();
      if (k) this.vapidPublicKey = k;
      return k ?? '';
    } catch {
      return '';
    }
  }

  private async fetchServerPushConfigured(): Promise<boolean> {
    try {
      const r = await firstValueFrom(
        this.http.get<{ publicKey: string }>(this.api.getPushVapidPublicKeyUrl()).pipe(
          timeout(WebPushRegistrationService.RX_FIRST_MS),
          take(1),
          catchError(() => of({ publicKey: '' }))
        )
      );
      return !!(r.publicKey?.trim());
    } catch {
      return false;
    }
  }
}
