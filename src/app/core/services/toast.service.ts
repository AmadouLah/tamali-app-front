import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts: Toast[] = [];
  private readonly maxToasts = 5;
  private readonly defaultDurationMs = 4500;

  readonly toasts$ = new BehaviorSubject<readonly Toast[]>(this.toasts);

  success(message: string, durationMs = this.defaultDurationMs): void {
    this.add({ type: 'success', message }, durationMs);
  }

  error(message: string, durationMs = this.defaultDurationMs): void {
    this.add({ type: 'error', message }, durationMs);
  }

  info(message: string, durationMs = this.defaultDurationMs): void {
    this.add({ type: 'info', message }, durationMs);
  }

  private add(item: Omit<Toast, 'id'>, durationMs: number): void {
    const toast: Toast = { ...item, id: crypto.randomUUID() };
    this.toasts.push(toast);
    if (this.toasts.length > this.maxToasts) this.toasts.shift();
    this.toasts$.next([...this.toasts]);

    if (durationMs > 0) {
      setTimeout(() => this.remove(toast.id), durationMs);
    }
  }

  remove(id: string): void {
    const i = this.toasts.findIndex(t => t.id === id);
    if (i >= 0) {
      this.toasts.splice(i, 1);
      this.toasts$.next([...this.toasts]);
    }
  }
}
