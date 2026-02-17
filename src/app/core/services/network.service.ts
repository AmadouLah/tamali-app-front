import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private onlineStatus$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    if (typeof window !== 'undefined') {
      const online$ = fromEvent(window, 'online').pipe(map(() => true));
      const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
      
      merge(online$, offline$).subscribe(status => {
        this.onlineStatus$.next(status);
      });
    }
  }

  get isOnline(): boolean {
    return this.onlineStatus$.value;
  }

  get onlineStatus(): Observable<boolean> {
    return this.onlineStatus$.asObservable();
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
