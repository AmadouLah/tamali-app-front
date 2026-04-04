import { Injectable, inject } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { ToastService } from './toast.service';

interface InstantPayload {
  message?: string;
  sentAt?: string;
}

@Injectable({ providedIn: 'root' })
export class InstantNotificationStreamService {
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);

  private abort: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private connectionGeneration = 0;

  startIfAuthenticated(): void {
    this.stopped = false;
    const generation = ++this.connectionGeneration;
    const token = localStorage.getItem('auth_token');
    const raw = localStorage.getItem('auth_user');
    if (!token || !raw) return;
    let user: { id?: string; roles?: Array<{ type?: string }> };
    try {
      user = JSON.parse(raw) as { id?: string; roles?: Array<{ type?: string }> };
    } catch {
      return;
    }
    if (!user?.id) return;

    this.abort?.abort();
    this.abort = new AbortController();
    const ac = this.abort;

    const url = this.apiConfig.getNotificationsStreamUrl();
    const role = user.roles?.[0]?.type ?? '';

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-User-Id': user.id,
        'X-User-Role': role
      },
      signal: ac.signal
    })
      .then(async res => {
        if (generation !== this.connectionGeneration) return;
        if (!res.ok || !res.body) {
          this.scheduleReconnect(generation);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!this.stopped && generation === this.connectionGeneration) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const block of parts) {
            this.consumeSseBlock(block);
          }
        }
        if (!this.stopped && generation === this.connectionGeneration) {
          this.scheduleReconnect(generation);
        }
      })
      .catch(() => {
        if (!this.stopped && generation === this.connectionGeneration) {
          this.scheduleReconnect(generation);
        }
      });
  }

  stop(): void {
    this.connectionGeneration++;
    this.stopped = true;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abort?.abort();
    this.abort = null;
  }

  private scheduleReconnect(generation: number): void {
    if (this.stopped || generation !== this.connectionGeneration || this.reconnectTimer != null) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopped || generation !== this.connectionGeneration) return;
      if (!localStorage.getItem('auth_token')) return;
      this.startIfAuthenticated();
    }, 5000);
  }

  private consumeSseBlock(block: string): void {
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const json = trimmed.slice(5).trim();
      if (!json || json === '[DONE]') continue;
      let payload: InstantPayload;
      try {
        payload = JSON.parse(json) as InstantPayload;
      } catch {
        continue;
      }
      const msg = payload.message?.trim();
      if (!msg) continue;
      this.toast.info(msg, 8000);
      this.maybeSystemNotification(msg);
    }
  }

  private maybeSystemNotification(body: string): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && !document.hidden) return;
    try {
      new Notification('Tamali', { body, icon: '/favicon.ico' });
    } catch {
      /* ignore */
    }
  }
}
