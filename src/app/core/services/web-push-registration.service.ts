import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, from, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class WebPushRegistrationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfigService);

  private static readonly RETRY_MS = 3000;
  private static readonly MAX_ATTEMPTS = 5;

  private vapidPublicKey: string | null = null;

  tryRegister(): void {
    if (!this.isEligibleForPush()) return;
    void this.runRegistration(0);
  }

  resetCachedVapidKey(): void {
    this.vapidPublicKey = null;
  }

  private isEligibleForPush(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.swPush.isEnabled) return false;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    return !!(localStorage.getItem('auth_token') && localStorage.getItem('auth_user'));
  }

  private async runRegistration(attempt: number): Promise<void> {
    if (!this.isEligibleForPush()) return;
    try {
      await navigator.serviceWorker.ready;
    } catch {
      return;
    }
    if (!this.isEligibleForPush()) return;

    const pk = await this.loadVapidPublicKey();
    if (!pk) {
      this.scheduleRetry(attempt);
      return;
    }

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
    } catch {
      if (Notification.permission === 'denied') return;
      this.scheduleRetry(attempt);
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
}
