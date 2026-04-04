import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { of } from 'rxjs';
import { take, tap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class WebPushRegistrationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfigService);

  private vapidPublicKey: string | null = null;

  tryRegister(): void {
    if (!this.swPush.isEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    if (!localStorage.getItem('auth_token') || !localStorage.getItem('auth_user')) return;

    const key$ = this.vapidPublicKey
      ? of({ publicKey: this.vapidPublicKey })
      : this.http.get<{ publicKey: string }>(this.api.getPushVapidPublicKeyUrl()).pipe(
          tap(r => {
            const k = r.publicKey?.trim();
            if (k) this.vapidPublicKey = k;
          })
        );

    key$.pipe(take(1)).subscribe({
      next: ({ publicKey }) => {
        const pk = publicKey?.trim();
        if (!pk) return;
        this.subscribeAndSync(pk);
      },
      error: () => {}
    });
  }

  resetCachedVapidKey(): void {
    this.vapidPublicKey = null;
  }

  private subscribeAndSync(publicKey: string): void {
    this.swPush.subscription.pipe(take(1)).subscribe({
      next: existing => {
        const promise = existing
          ? Promise.resolve(existing)
          : this.swPush.requestSubscription({ serverPublicKey: publicKey });
        void promise
          .then(sub => {
            this.http.post(this.api.getPushSubscribeUrl(), sub.toJSON()).subscribe({ error: () => {} });
          })
          .catch(() => {});
      }
    });
  }
}
